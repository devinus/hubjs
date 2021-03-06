// ==========================================================================
// Project:   hub.js - cloud-friendly object graph sync
// Copyright: ©2010 Erich Ocean.
//            Portions ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple Inc. All rights reserved.
// License:   Licensed under an MIT license (see license.js).
// ==========================================================================
/*global hub */

/**
  A nested stores can buffer changes to a parent store and then commit them
  all at once.  You usually will use a NestedStore as part of store chaining
  to stage changes to your object graph before sharing them with the rest of
  the application.
  
  Normally you will not create a nested store directly.  Instead, you can 
  retrieve a nested store by using the chain() method.  When you are finished
  working with the nested store, destroy() will dispose of it.
  
  @mixin
*/
hub.ChildStore = {

  /**
    Walk like a duck.
    
    @readOnly
    @property {Boolean}
  */
  isChildStore: true,
  
  /**
    This is set to true when there are changes that have not been committed 
    yet.

    @property {Boolean}
    @default false
  */
  hasChanges: false,

  /**
    The parent store this nested store is chained to.  Nested stores must have
    a parent store in order to function properly.  Normally, you create a 
    nested store using the hub.Store#chain() method and this property will be
    set for you.
    
    @property {hub.Store}
  */
  parentStore: null,

  /**
    true if the view is nested. Walk like a duck.
    
    FIXME: Remove eventually in favor of isChildStore.
    
    @property {Boolean}
  */
  isNested: true,

  /**
    If true, then the attribute hash state will be locked when you first 
    read the data hash or status.  This means that if you retrieve a record
    then change the record in the parent store, the changes will not be 
    visible to your nested store until you commit or discard changes.
    
    If false, then the attribute hash will lock only when you write data.
    
    Normally you want to lock your attribute hash the first time you read it.
    This will make your nested store behave most consistently.  However, if
    you are using multiple sibling nested stores at one time, you may want
    to turn off this property so that changes from one store will be reflected
    in the other one immediately.  In this case you will be responsible for
    ensuring that the sibling stores do not edit the same part of the object
    graph at the same time.
    
    @property {Boolean} 
  */
  lockOnRead: true,

  /** @private
    Array contains the base revision for an attribute hash when it was first
    cloned from the parent store.  If the attribute hash is edited and 
    commited, the commit will fail if the parent attributes hash has been 
    edited since.
    
    This is a form of optimistic locking, hence the name.
    
    Each store gets its own array of locks, which are selectively populated
    as needed.
    
    Note that this is kept as an array because it will be stored as a dense 
    array on some browsers, making it faster.
    
    @property {Array}
  */
  locks: null,

  /** @private
    An array that includes the store keys that have changed since the store
    was last committed.  This array is used to sync data hash changes between
    chained stores.  For a log changes that may actually be committed back to
    the server see the changelog property.
    
    @property {Array}
  */
  chainedChanges: null,
    
  // ..........................................................
  // STORE CHAINING
  // 
  
  /**
    find() cannot accept REMOTE queries in a nested store.  This override will
    verify that condition for you.  See hub.Store#find() for info on using this
    method.
    
    @returns {hub.Record|hub.RecordArray}
  */
  find: function(query) {
    if (query && query.isQuery && query.get('location') !== hub.Query.LOCAL) {
      throw "hub.Store#find() can only accept LOCAL queries in nested stores";
    }
    return arguments.callee.base.apply(this, arguments) ;
  },
  
  /**
    Propagate this store's changes to its parent.  If the store does not 
    have a parent, this has no effect other than to clear the change set.

    @param {Boolean} force if true, does not check for conflicts first
    @returns {hub.Store} receiver
  */
  commitChanges: function(force) {
    if (this.get('hasChanges')) {
      var pstore = this.get('parentStore');
      pstore.commitChangesFromNestedStore(this, this.chainedChanges, force);
    }

    // clear out custom changes - even if there is nothing to commit.
    this.reset();
    return this ;
  },

  /**
    Discard the changes made to this store and reset the store.
    
    @returns {hub.Store} receiver
  */
  discardChanges: function() {
    
    // any locked records whose rev or lock rev differs from parent need to
    // be notified.
    var records, locks;
    if ((records = this.records) && (locks = this.locks)) {
      var pstore = this.get('parentStore'), psRevisions = pstore.revisions;
      var revisions = this.revisions, storeKey, lock, rev;
      for(storeKey in records) {
        if (!records.hasOwnProperty(storeKey)) continue ;
        if (!(lock = locks[storeKey])) continue; // not locked.

        rev = psRevisions[storeKey];
        if ((rev !== lock) || (revisions[storeKey] > rev)) {
          this._hub_notifyRecordPropertyChange(storeKey);
        }
      }
    }
    
    this.reset();
    this.flush();
    return this ;
  },
  
  /**
    When you are finished working with a chained store, call this method to 
    tear it down.  This will also discard any pending changes.
    
    @returns {hub.Store} receiver
  */
  destroy: function() {
    this.discardChanges();
    
    var parentStore = this.get('parentStore');
    if (parentStore) parentStore.willDestroyNestedStore(this);
    
    arguments.callee.base.apply(this, arguments) ;
    return this ;
  },

  /**
    Resets a store's data hash contents to match its parent.
    
    @returns {hub.Store} receiver
  */
  reset: function() {

    // requires a pstore to reset
    var parentStore = this.get('parentStore');
    if (!parentStore) throw hub.Store.NO_PARENT_STORE_ERROR;
    
    // inherit data store from parent store.
    this.dataHashes = hub.beget(parentStore.dataHashes);
    this.revisions  = hub.beget(parentStore.revisions);
    this.statuses   = hub.beget(parentStore.statuses);
    
    // also, reset private temporary objects
    this.chainedChanges = this.locks = this.editables = null;
    this.changelog = null ;

    // TODO: Notify record instances
    
    this.set('hasChanges', false);
  },
  
  /** @private
  
    Chain to parentstore
  */
  refreshQuery: function(query) {
    var parentStore = this.get('parentStore');
    if (parentStore) parentStore.refreshQuery(query);
    return this ;      
  },

  /**
    Returns the hub.Error object associated with a specific record.

    Delegates the call to the parent store.

    @param {Number} storeKey The store key of the record.
 
    @returns {hub.Error} hub.Error or null if no error associated with the record.
  */
  readError: function(storeKey) {
    var parentStore = this.get('parentStore');
    return parentStore ? parentStore.readError(storeKey) : null;
  },

  /**
    Returns the hub.Error object associated with a specific query.

    Delegates the call to the parent store.

    @param {hub.Query} query The hub.Query with which the error is associated.
 
    @returns {hub.Error} hub.Error or null if no error associated with the query.
  */
  readQueryError: function(query) {
    var parentStore = this.get('parentStore');
    return parentStore ? parentStore.readQueryError(query) : null;
  },
  
  // ..........................................................
  // CORE ATTRIBUTE API
  // 
  // The methods in this layer work on data hashes in the store.  They do not
  // perform any changes that can impact records.  Usually you will not need 
  // to use these methods.
  
  /**
    Returns the current edit status of a storekey.  May be one of INHERITED,
    EDITABLE, and LOCKED.  Used mostly for unit testing.
    
    @param {Number} storeKey the store key
    @returns {Number} edit status
  */
  storeKeyEditState: function(storeKey) {
    var editables = this.editables, locks = this.locks;
    return (editables && editables[storeKey]) ? hub.Store.EDITABLE : (locks && locks[storeKey]) ? hub.Store.LOCKED : hub.Store.INHERITED ;
  },
   
  /**  @private
    Locks the data hash so that it iterates independently from the parent 
    store.
  */
  _hub_lock: function(storeKey) {
    var locks = this.locks, rev, editables;
    
    // already locked -- nothing to do
    if (locks && locks[storeKey]) return this;

    // create locks if needed
    if (!locks) locks = this.locks = [];

    // fixup editables
    editables = this.editables;
    if (editables) editables[storeKey] = 0;
    
    
    // if the data hash in the parent store is editable, then clone the hash
    // for our own use.  Otherwise, just copy a reference to the data hash
    // in the parent store. -- find first non-inherited state
    var pstore = this.get('parentStore'), editState;
    while(pstore && (editState=pstore.storeKeyEditState(storeKey)) === hub.Store.INHERITED) {
      pstore = pstore.get('parentStore');
    }
    
    if (pstore && editState === hub.Store.EDITABLE) {
      this.dataHashes[storeKey] = hub.clone(pstore.dataHashes[storeKey]);
      if (!editables) editables = this.editables = [];
      editables[storeKey] = 1 ; // mark as editable
      
    } else this.dataHashes[storeKey] = this.dataHashes[storeKey];
    
    // also copy the status + revision
    this.statuses[storeKey] = this.statuses[storeKey];
    rev = this.revisions[storeKey] = this.revisions[storeKey];
    
    // save a lock and make it not editable
    locks[storeKey] = rev || 1;    
    
    return this ;
  },
  
  /** @private - adds chaining support */
  readDataHash: function(storeKey) {
    if (this.get('lockOnRead')) this._hub_lock(storeKey);
    return this.dataHashes[storeKey];
  },
  
  /** @private - adds chaining support */
  readEditableDataHash: function(storeKey) {

    // lock the data hash if needed
    this._hub_lock(storeKey);
    
    return arguments.callee.base.apply(this, arguments) ;
  },
  
  /** @private - adds chaining support - 
    Does not call arguments.callee.base.apply(this, arguments) because the 
    implementation of the methods vary too much.
  */
  writeDataHash: function(storeKey, hash, status) {
    var locks = this.locks, rev ;
    
    // update dataHashes and optionally status.  Note that if status is not
    // passed, we want to copy the reference to the status anyway to lock it
    // in.
    if (hash) this.dataHashes[storeKey] = hash;
    this.statuses[storeKey] = status ? status : (this.statuses[storeKey] || hub.Record.READY_NEW);
    rev = this.revisions[storeKey] = this.revisions[storeKey]; // copy ref
    
    // make sure we lock if needed.
    if (!locks) locks = this.locks = [];
    if (!locks[storeKey]) locks[storeKey] = rev || 1;
    
    // also note that this hash is now editable
    var editables = this.editables;
    if (!editables) editables = this.editables = [];
    editables[storeKey] = 1 ; // use number for dense array support
    
    return this ;
  },

  /** @private - adds chaining support */
  removeDataHash: function(storeKey, status) {
    
    // record optimistic lock revision
    var locks = this.locks;
    if (!locks) locks = this.locks = [];
    if (!locks[storeKey]) locks[storeKey] = this.revisions[storeKey] || 1;

    return arguments.callee.base.apply(this, arguments) ;
  },
  
  /** @private - book-keeping for a single data hash. */
  dataHashDidChange: function(storeKeys, rev, statusOnly, key) {
    
    // update the revision for storeKey.  Use generateStoreKey() because that
    // gaurantees a universally (to this store hierarchy anyway) unique 
    // key value.
    if (!rev) rev = hub.Store.generateStoreKey();
    var isArray, len, idx, storeKey;
    
    isArray = hub.typeOf(storeKeys) === hub.T_ARRAY;
    if (isArray) {
      len = storeKeys.length;
    } else {
      len = 1;
      storeKey = storeKeys;
    }

    var changes = this.chainedChanges;
    if (!changes) changes = this.chainedChanges = hub.Set.create();
    
    for(idx=0;idx<len;idx++) {
      if (isArray) storeKey = storeKeys[idx];
      this._hub_lock(storeKey);
      this.revisions[storeKey] = rev;
      changes.add(storeKey);
      this._hub_notifyRecordPropertyChange(storeKey, statusOnly, key);
    }

    this.setIfChanged('hasChanges', true);
    return this ;
  },

  // ..........................................................
  // SYNCING CHANGES
  // 
  
  /** @private - adapt for nested store */
  commitChangesFromNestedStore: function(nestedStore, changes, force) {
    arguments.callee.base.apply(this, arguments) ;
    
    // save a lock for each store key if it does not have one already
    // also add each storeKey to my own changes set.
    var pstore = this.get('parentStore'), psRevisions = pstore.revisions, i;
    var myLocks = this.locks, myChanges = this.chainedChanges,len,storeKey;
    if (!myLocks) myLocks = this.locks = [];
    if (!myChanges) myChanges = this.chainedChanges = hub.Set.create();

    len = changes.length ;
    for(i=0;i<len;i++) {
      storeKey = changes[i];
      if (!myLocks[storeKey]) myLocks[storeKey] = psRevisions[storeKey]||1;
      myChanges.add(storeKey);
    }
    
    // Finally, mark store as dirty if we have changes
    this.setIfChanged('hasChanges', myChanges.get('length')>0);
    this.flush();
    
    return this ;
  },
  
  // ..........................................................
  // HIGH-LEVEL RECORD API
  // 
  
  /** @private - adapt for nested store */
  queryFor: function(recordType, conditions, params) {
    return this.get('parentStore').queryFor(recordType, conditions, params);
  },
  
  // ..........................................................
  // CORE RECORDS API
  // 
  // The methods in this section can be used to manipulate records without 
  // actually creating record instances.
  
  /** @private - adapt for nested store
  
    Unlike for the main store, for nested stores if isRefresh=true, we'll throw
    an error if the record is dirty.  We'll otherwise avoid setting our status
    because that can disconnect us from upper and/or lower stores.
  */
  retrieveRecords: function(recordTypes, ids, storeKeys, isRefresh) {
    var pstore = this.get('parentStore'), idx, storeKey, newStatus,
      len = (!storeKeys) ? ids.length : storeKeys.length,
      K = hub.Record, status;

    // Is this a refresh?
    if (isRefresh) {
      for(idx=0;idx<len;idx++) {
        storeKey = !storeKeys ? pstore.storeKeyFor(recordTypes, ids[idx]) : storeKeys[idx];
        status   = this.peekStatus(storeKey);
        
        // We won't allow calling retrieve on a dirty record in a nested store
        // (although we do allow it in the main store).  This is because doing
        // so would involve writing a unique status, and that would break the
        // status hierarchy, so even though lower stores would complete the
        // retrieval, the upper layers would never inherit the new statuses.
        if (status & K.DIRTY) {
          throw hub.Store.NESTED_STORE_RETRIEVE_DIRTY_ERROR;
        }
        else {
          // Not dirty?  Then abandon any status we had set (to re-establish
          // any prototype linkage breakage) before asking our parent store to
          // perform the retrieve.
          var dataHashes = this.dataHashes,
              revisions  = this.revisions,
              statuses   = this.statuses,
              editables  = this.editables,
              locks      = this.locks;

          var changed    = false;
          var statusOnly = false;
  
          if (dataHashes  &&  dataHashes.hasOwnProperty(storeKey)) {
            delete dataHashes[storeKey];
            changed = true;
          }
          if (revisions   &&  revisions.hasOwnProperty(storeKey)) {
            delete revisions[storeKey];
            changed = true;
          }
          if (editables) delete editables[storeKey];
          if (locks) delete locks[storeKey];

          if (statuses  &&  statuses.hasOwnProperty(storeKey)) {
            delete statuses[storeKey];
            if (!changed) statusOnly = true;
            changed = true;
          }
          
          if (changed) this._hub_notifyRecordPropertyChange(storeKey, statusOnly);
        }
      }
    }
    
    return pstore.retrieveRecords(recordTypes, ids, storeKeys, isRefresh);
  },

  /** @private - adapt for nested store */
  commitRecords: function(recordTypes, ids, storeKeys) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },

  /** @private - adapt for nested store */
  commitRecord: function(recordType, id, storeKey) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },
  
  /** @private - adapt for nested store */
  cancelRecords: function(recordTypes, ids, storeKeys) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },

  /** @private - adapt for nested store */
  cancelRecord: function(recordType, id, storeKey) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },
  
  // ..........................................................
  // DATA SOURCE CALLBACKS
  // 
  // Mathods called by the data source on the store

  /** @private - adapt for nested store */
  dataSourceDidCancel: function(storeKey) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },
  
  /** @private - adapt for nested store */
  dataSourceDidComplete: function(storeKey, dataHash, newId) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },
  
  /** @private - adapt for nested store */
  dataSourceDidDestroy: function(storeKey) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },

  /** @private - adapt for nested store */
  dataSourceDidError: function(storeKey, error) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },

  // ..........................................................
  // PUSH CHANGES FROM DATA SOURCE
  // 
  
  /** @private - adapt for nested store */
  pushRetrieve: function(recordType, id, dataHash, storeKey) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },
  
  /** @private - adapt for nested store */
  pushDestroy: function(recordType, id, storeKey) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  },

  /** @private - adapt for nested store */
  pushError: function(recordType, id, error, storeKey) {
    throw hub.Store.NESTED_STORE_UNSUPPORTED_ERROR;
  }
};