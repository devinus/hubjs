// ==========================================================================
// Project:   hub.js - cloud-friendly object graph sync
// Copyright: ©2010 Erich Ocean.
//            Portions ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple Inc. All rights reserved.
// License:   Licensed under an MIT license (see license.js).
// ==========================================================================
/*global hub */

/**
  Set to true to have all observing activity logged to hub.debug().  This 
  should be used for debugging only.
  
  NOTE: This property is not observable.
  
  @property {Boolean}
*/
hub.LOG_OBSERVERS = false ;

/**
  Key-Value-Observing (KVO) simply allows one object to observe changes to a 
  property on another object. It is one of the fundamental ways that hub.js 
  communicates changes made to your object graph. Any object that has this
  module applied to it can be used in KVO-operations.
  
  This module is applied automatically to all objects that inherit from 
  hub.Object, which includes most objects bundled with hub.js.  You will not 
  generally apply this module to classes yourself, but you will use the 
  features provided by this module frequently, so it is important to understand 
  how to use it.
  
  h2. Enabling Key Value Observing
  
  With KVO, you can write functions that will be called automatically whenever 
  a property on a particular object changes.  You can use this feature to 
  reduce the amount of "glue code" that you often write to tie the various 
  parts of your application together.
  
  To use KVO, just use the KVO-aware methods get() and set() to access 
  properties instead of accessing properties directly:
  
  {{{
    var aName = contact.get('firstName') ;
    contact.set('firstName', 'Erich') ;
  }}}
  
  Don't do this:
  
  {{{
    var aName = contact.firstName ;
    contact.firstName = 'Erich' ;
  }}}
  
  get() and set() work just like the normal "dot operators" provided by 
  JavaScript but they provide you with much more power, including not only 
  observing but computed properties as well.
  
  h2. Observing Property Changes
  
  You typically observe property changes simply by adding the observes() 
  call to the end of your method declarations in classes that you write.  For 
  example:
  
  {{{
    hub.Object.create({
      valueObserver: function() {
        // Executes whenever the 'value' property changes.
      }.observes('value')
    }) ;
  }}}
  
  Although this is the most common way to add an observer, this capability is 
  actually built into the hub.Object class on top of two methods defined in 
  this mixin called addObserver() and removeObserver().  You can use these two 
  methods to add and remove observers yourself if you need to do so at run 
  time.  
  
  To add an observer for a property, just call:
  
  {{{
    object.addObserver('aPropertyKey', targetObject, targetAction) ;
  }}}
  
  This will call the 'targetAction' method of targetObject whenever the value 
  of 'aPropertyKey' changes.
  
  h2. Observer Parameters
  
  An observer function typically does not need to accept any parameters, 
  however you can accept certain arguments when writing generic observers. 
  An observer function can have the following arguments:
  
  {{{
    propertyObserver(target, key, revision) ;
  }}}
  
  - *target* - This is the object whose value changed.  Usually the receiver.
  - *key* - The key of the value that changed.
  - *revision* - The revision of the target object.
  
  h2. Implementing Manual Change Notifications
  
  Sometimes you may want to control the rate at which notifications for 
  a property are delivered, for example by checking first to make sure 
  that the value has changed.
  
  To do this, you need to implement a computed property for the property 
  you want to change and override automaticallyNotifiesObserversFor().
  
  The example below will only notify if the "balance" property value actually 
  changes:
  
  {{{
    
    automaticallyNotifiesObserversFor: function(key) {
      return (key === 'balance') ? false : arguments.callee.base.apply() ;
    },
    
    balance: function(key, value) {
      var balance = this._balance ;
      if ((value !== undefined) && (balance !== value)) {
        this.propertyWillChange(key) ;
        balance = this._balance = value ;
        this.propertyDidChange(key) ;
      }
      return balance ;
    }
    
  }}}
  
  h1. Implementation Details
  
  Internally, hub.js keeps track of observable information by adding a number 
  of properties to the object adopting the observable.  All of these properties 
  begin with "_kvo_" to separate them from the rest of your object.
  
  @mixin
*/
hub.Observable = {

  /** 
    Walk like that ol' duck 
    
    @property {Boolean}
  */
  isObservable: true,
  
  /**
    Determines whether observers should be automatically notified of changes
    to a key.
    
    If you are manually implementing change notifications for a property, you
    can override this method to return false for properties you do not want the
    observing system to automatically notify for.
    
    The default implementation always returns true.
    
    @param key {String} the key that is changing
    @returns {Boolean} true if automatic notification should occur.
  */
  automaticallyNotifiesObserversFor: function(key) { 
    return true;
  },

  // ..........................................
  // PROPERTIES
  // 
  // Use these methods to get/set properties.  This will handle observing
  // notifications as well as allowing you to define functions that can be 
  // used as properties.

  /**  
    Retrieves the value of key from the object.
    
    This method is generally very similar to using object[key] or object.key,
    however it supports both computed properties and the unknownProperty
    handler.
    
    *Computed Properties*
    
    Computed properties are methods defined with the property() modifier
    declared at the end, such as:
    
    {{{
      fullName: function() {
        return this.getEach('firstName', 'lastName').compact().join(' ');
      }.property('firstName', 'lastName')
    }}}
    
    When you call get() on a computed property, the property function will be
    called and the return value will be returned instead of the function
    itself.
    
    *Unknown Properties*
    
    Likewise, if you try to call get() on a property whose values is
    undefined, the unknownProperty() method will be called on the object.
    If this method reutrns any value other than undefined, it will be returned
    instead.  This allows you to implement "virtual" properties that are 
    not defined upfront.
    
    @param key {String} the property to retrieve
    @returns {Object} the property value or undefined.
    
  */
  get: function(key) {
    var ret = this[key], cache ;
    if (ret === undefined) {
      return this.unknownProperty(key) ;
    } else if (ret && ret.isProperty) {
      if (ret.isCacheable) {
        cache = this._hub_kvo_cache ;
        if (!cache) cache = this._hub_kvo_cache = {};
        return (cache[ret.cacheKey] !== undefined) ? cache[ret.cacheKey] : (cache[ret.cacheKey] = ret.call(this,key)) ;
      } else return ret.call(this,key);
    } else return ret ;
  },

  /**  
    Sets the key equal to value.
    
    This method is generally very similar to calling object[key] = value or
    object.key = value, except that it provides support for computed 
    properties, the unknownProperty() method and property observers.
    
    *Computed Properties*
    
    If you try to set a value on a key that has a computed property handler
    defined (see the get() method for an example), then set() will call
    that method, passing both the value and key instead of simply changing 
    the value itself.  This is useful for those times when you need to 
    implement a property that is composed of one or more member
    properties.
    
    *Unknown Properties*
    
    If you try to set a value on a key that is undefined in the target 
    object, then the unknownProperty() handler will be called instead.  This
    gives you an opportunity to implement complex "virtual" properties that
    are not predefined on the obejct.  If unknownProperty() returns 
    undefined, then set() will simply set the value on the object.
    
    *Property Observers*
    
    In addition to changing the property, set() will also register a 
    property change with the object.  Unless you have placed this call 
    inside of a beginPropertyChanges() and endPropertyChanges(), any "local"
    observers (i.e. observer methods declared on the same object), will be
    called immediately.  Any "remote" observers (i.e. observer methods 
    declared on another object) will be placed in a queue and called at a
    later time in a coalesced manner.
    
    *Chaining*
    
    In addition to property changes, set() returns the value of the object
    itself so you can do chaining like this:
    
    {{{
      record.set('firstName', 'Charles').set('lastName', 'Jolley');
    }}}
    
    @param key {String} the property to set
    @param value {Object} the value to set or null.
    @returns {hub.Observable}
  */
  set: function(key, value) {
    var func   = this[key], 
        notify = this.automaticallyNotifiesObserversFor(key),
        ret    = value, 
        cachedep, cache, idx, dfunc ;

    // if there are any dependent keys and they use caching, then clear the
    // cache.
    if (this._hub_kvo_cacheable && (cache = this._hub_kvo_cache)) {
      // lookup the cached dependents for this key.  if undefined, compute.
      // note that if cachdep is set to null is means we figure out it has no
      // cached dependencies already.  this is different from undefined.
      cachedep = this._hub_kvo_cachedep;
      if (!cachedep || (cachedep = cachedep[key])===undefined) {
        cachedep = this._hub_kvo_computeCachedDependentsFor(key);
      }
      
      if (cachedep) {
        idx = cachedep.length;
        while(--idx>=0) {
          dfunc = cachedep[idx];
          cache[dfunc.cacheKey] = cache[dfunc.lastSetValueKey] = undefined;
        }
      }
    }

    // set the value.
    if (func && func.isProperty) {
      cache = this._hub_kvo_cache;
      if (func.isVolatile || !cache || (cache[func.lastSetValueKey] !== value)) {
        if (!cache) cache = this._hub_kvo_cache = {};

        cache[func.lastSetValueKey] = value ;
        if (notify) this.propertyWillChange(key) ;
        ret = func.call(this,key,value) ;

        // update cached value
        if (func.isCacheable) cache[func.cacheKey] = ret ;
        if (notify) this.propertyDidChange(key, ret, true) ;
      }

    } else if (func === undefined) {
      if (notify) this.propertyWillChange(key) ;
      this.unknownProperty(key,value) ;
      if (notify) this.propertyDidChange(key, ret) ;

    } else {
      if (this[key] !== value) {
        if (notify) this.propertyWillChange(key) ;
        ret = this[key] = value ;
        if (notify) this.propertyDidChange(key, ret) ;
      }
    }

    return this ;
  },

  /**  
    Called whenever you try to get or set an undefined property.
    
    This is a generic property handler.  If you define it, it will be called
    when the named property is not yet set in the object.  The default does
    nothing.
    
    @param key {String} the key that was requested
    @param value {Object} The value if called as a setter, undefined if called as a getter.
    @returns {Object} The new value for key.
  */
  unknownProperty: function(key,value) {
    if (!(value === undefined)) { this[key] = value; }
    return value ;
  },

  /**  
    Begins a grouping of property changes.
    
    You can use this method to group property changes so that notifications
    will not be sent until the changes are finished.  If you plan to make a 
    large number of changes to an object at one time, you should call this 
    method at the beginning of the changes to suspend change notifications.
    When you are done making changes, all endPropertyChanges() to allow 
    notification to resume.
    
    @returns {hub.Observable}
  */
  beginPropertyChanges: function() {
    this._hub_kvo_changeLevel = (this._hub_kvo_changeLevel || 0) + 1; 
    return this;
  },

  /**  
    Ends a grouping of property changes.
    
    You can use this method to group property changes so that notifications
    will not be sent until the changes are finished.  If you plan to make a 
    large number of changes to an object at one time, you should call 
    beginPropertyChanges() at the beginning of the changes to suspend change 
    notifications. When you are done making changes, call this method to allow 
    notification to resume.
    
    @returns {hub.Observable}
  */
  endPropertyChanges: function() {
    this._hub_kvo_changeLevel = (this._hub_kvo_changeLevel || 1) - 1 ;
    var level = this._hub_kvo_changeLevel, changes = this._hub_kvo_changes;
    if ((level<=0) && changes && (changes.length>0) && !hub.ObserverQueue.isObservingSuspended) {
      this._hub_notifyPropertyObservers() ;
    } 
    return this ;
  },

  /**  
    Notify the observer system that a property is about to change.

    Sometimes you need to change a value directly or indirectly without 
    actually calling get() or set() on it.  In this case, you can use this 
    method and propertyDidChange() instead.  Calling these two methods 
    together will notify all observers that the property has potentially 
    changed value.
    
    Note that you must always call propertyWillChange and propertyDidChange as 
    a pair.  If you do not, it may get the property change groups out of order 
    and cause notifications to be delivered more often than you would like.
    
    @param key {String} The property key that is about to change.
    @returns {hub.Observable}
  */
  propertyWillChange: function(key) {
    return this ;
  },

  /**  
    Notify the observer system that a property has just changed.

    Sometimes you need to change a value directly or indirectly without 
    actually calling get() or set() on it.  In this case, you can use this 
    method and propertyWillChange() instead.  Calling these two methods 
    together will notify all observers that the property has potentially 
    changed value.
    
    Note that you must always call propertyWillChange and propertyDidChange as 
    a pair. If you do not, it may get the property change groups out of order 
    and cause notifications to be delivered more often than you would like.
    
    @param key {String} The property key that has just changed.
    @param value {Object} The new value of the key.  May be null.
    @returns {hub.Observable}
  */
  propertyDidChange: function(key,value, _hub_keepCache) {

    this._hub_kvo_revision = (this._hub_kvo_revision || 0) + 1; 
    var level = this._hub_kvo_changeLevel || 0,
        cachedep, idx, dfunc, cache, func,
        log = hub.LOG_OBSERVERS && !(this.LOG_OBSERVING===false);

    if (this._hub_kvo_cacheable && (cache = this._hub_kvo_cache)) {

      // clear any cached value
      if (!_hub_keepCache) {
        func = this[key] ;
        if (func && func.isProperty) {
          cache[func.cacheKey] = cache[func.lastSetValueKey] = undefined ;
        }
      }

      // if there are any dependent keys and they use caching, then clear the
      // cache.  This is the same code as is in set.  It is inlined for perf.
      cachedep = this._hub_kvo_cachedep;
      if (!cachedep || (cachedep = cachedep[key])===undefined) {
        cachedep = this._hub_kvo_computeCachedDependentsFor(key);
      }

      if (cachedep) {
        idx = cachedep.length;
        while(--idx>=0) {
          dfunc = cachedep[idx];
          cache[dfunc.cacheKey] = cache[dfunc.lastSetValueKey] = undefined;
        }
      }
    }

    // save in the change set if queuing changes
    var suspended = hub.ObserverQueue.isObservingSuspended;
    if ((level > 0) || suspended) {
      var changes = this._hub_kvo_changes ;
      if (!changes) changes = this._hub_kvo_changes = hub.CoreSet.create() ;
      changes.add(key) ;
      
      if (suspended) {
        if (log) hub.debug([hub.KVO_SPACES,this].join(''), "will not notify observers because observing is suspended");
        hub.ObserverQueue.objectHasPendingChanges(this) ;
      }
      
    // otherwise notify property observers immediately
    } else this._hub_notifyPropertyObservers(key) ;
    
    return this ;
  },

  // ..........................................
  // DEPENDENT KEYS
  // 

  /**
    Use this to indicate that one key changes if other keys it depends on 
    change.  Pass the key that is dependent and additional keys it depends
    upon.  You can either pass the additional keys inline as arguments or 
    in a single array.
    
    You generally do not call this method, but instead pass dependent keys to
    your property() method when you declare a computed property.
    
    You can call this method during your init to register the keys that should
    trigger a change notification for your computed properties.  
    
    @param {String} key the dependent key
    @param {Array|String} dependentKeys one or more dependent keys 
    @returns {Object} this
  */  
  registerDependentKey: function(key, dependentKeys) {
    var dependents = this._hub_kvo_dependents,
        func       = this[key],
        keys, idx, lim, dep, queue;

    // normalize input.
    if (hub.typeOf(dependentKeys) === hub.T_ARRAY) {
      keys = dependentKeys;
      lim  = 0;
    } else {
      keys = arguments;
      lim  = 1;
    }
    idx  = keys.length;

    // define dependents if not defined already.
    if (!dependents) this._hub_kvo_dependents = dependents = {} ;

    // for each key, build array of dependents, add this key...
    // note that we ignore the first argument since it is the key...
    while(--idx >= lim) {
      dep = keys[idx] ;

      // add dependent key to dependents array of key it depends on
      queue = dependents[dep] ;
      if (!queue) queue = dependents[dep] = [] ;
      queue.push(key) ;
    }
  },

  /** @private 
  
    Helper method used by computeCachedDependents.  Just loops over the 
    array of dependent keys.  If the passed function is cacheable, it will
    be added to the queue.  Also, recursively call on each keys dependent 
    keys.
  
    @param {Array} queue the queue to add functions to
    @param {Array} keys the array of dependent keys for this key
    @param {Hash} dependents the _kvo_dependents cache
    @param {hub.Set} seen already seen keys
    @returns {void}
  */
  _hub_kvo_addCachedDependents: function(queue, keys, dependents, seen) {
    var idx = keys.length,
        func, key, deps ;
        
    while(--idx >= 0) {
      key  = keys[idx];
      seen.add(key);
      
      // if the value for this key is a computed property, then add it to the
      // set if it is cacheable, and process any of its dependent keys also.
      func = this[key];
      if (func && (func instanceof Function) && func.isProperty) {
        if (func.isCacheable) queue.push(func); // handle this func
        if ((deps = dependents[key]) && deps.length>0) { // and any dependents
          this._hub_kvo_addCachedDependents(queue, deps, dependents, seen);
        }
      } 
    }
        
  },
  
  /** @private

    Called by set() whenever it needs to determine which cached dependent
    keys to clear.  Recursively searches dependent keys to determine all 
    cached property direcly or indirectly affected.
    
    The return value is also saved for future reference
    
    @param {String} key the key to compute
    @returns {Array}
  */
  _hub_kvo_computeCachedDependentsFor: function(key) {
    var cached     = this._hub_kvo_cachedep,
        dependents = this._hub_kvo_dependents,
        keys       = dependents ? dependents[key] : null,
        queue, seen ;
    if (!cached) cached = this._hub_kvo_cachedep = {};

    // if there are no dependent keys, then just set and return null to avoid
    // this mess again.
    if (!keys || keys.length===0) return cached[key] = null;

    // there are dependent keys, so we need to do the work to find out if 
    // any of them or their dependent keys are cached.
    queue = cached[key] = [];
    seen  = hub._hub_TMP_SEEN_SET = (hub._hub_TMP_SEEN_SET || hub.CoreSet.create());
    seen.add(key);
    this._hub_kvo_addCachedDependents(queue, keys, dependents, seen);
    seen.clear(); // reset
    
    if (queue.length === 0) queue = cached[key] = null ; // turns out nothing
    return queue ;
  },
  
  // ..........................................
  // OBSERVERS
  // 
  
  _hub_kvo_for: function(kvoKey, type) {
    var ret = this[kvoKey] ;

    if (!this._hub_kvo_cloned) this._hub_kvo_cloned = {} ;
    
    // if the item does not exist, create it.  Unless type is passed, 
    // assume array.
    if (!ret) {
      ret = this[kvoKey] = (type === undefined) ? [] : type.create();
      this._hub_kvo_cloned[kvoKey] = true ;
      
    // if item does exist but has not been cloned, then clone it.  Note
    // that all types must implement copy().0
    } else if (!this._hub_kvo_cloned[kvoKey]) {
      ret = this[kvoKey] = ret.copy();
      this._hub_kvo_cloned[kvoKey] = true; 
    }
    
    return ret ;
  },

  /**  
    Adds an observer on a property.
    
    This is the core method used to register an observer for a property.
    
    Once you call this method, anytime the key's value is set, your observer
    will be notified.  Note that the observers are triggered anytime the
    value is set, regardless of whether it has actually changed.  Your
    observer should be prepared to handle that.
    
    You can also pass an optional context parameter to this method.  The 
    context will be passed to your observer method whenever it is triggered.
    Note that if you add the same target/method pair on a key multiple times
    with different context parameters, your observer will only be called once
    with the last context you passed.
    
    h2. Observer Methods
    
    Observer methods you pass should generally have the following signature if
    you do not pass a "context" parameter:
    
    {{{
      fooDidChange: function(sender, key, value, rev);
    }}}
    
    The sender is the object that changed.  The key is the property that
    changes.  The value property is currently reserved and unused.  The rev
    is the last property revision of the object when it changed, which you can
    use to detect if the key value has really changed or not.
    
    If you pass a "context" parameter, the context will be passed before the
    revision like so:
    
    {{{
      fooDidChange: function(sender, key, value, context, rev);
    }}}
    
    Usually you will not need the value, context or revision parameters at 
    the end.  In this case, it is common to write observer methods that take
    only a sender and key value as parameters or, if you aren't interested in
    any of these values, to write an observer that has no parameters at all.
    
    @param key {String} the key to observer
    @param target {Object} the target object to invoke
    @param method {String|Function} the method to invoke.
    @param context {Object} optional context
    @returns {hub.Object} self
  */
  addObserver: function(key, target, method, context) {
    
    var kvoKey, chain, chains, observers;
    
    // normalize.  if a function is passed to target, make it the method.
    if (method === undefined) {
      method = target; target = this ;
    }
    if (!target) target = this ;
    if (hub.typeOf(method) === hub.T_STRING) method = target[method] ;
    if (!method) throw "You must pass a method to addObserver()" ;

    // Normalize key...
    key = key.toString() ;
    if (key.indexOf('.') >= 0) {
      
      // create the chain and save it for later so we can tear it down if 
      // needed.
      chain = hub._hub_ChainObserver.createChain(this, key, target, method, context);
      chain.masterTarget = target;  
      chain.masterMethod = method ;
      
      // Save in set for chain observers.
      this._hub_kvo_for(hub.keyFor('_kvo_chains', key)).push(chain);
      
    // Create observers if needed...
    } else {
      
      // Special case to support reduced properties.  If the property 
      // key begins with '@' and its value is unknown, then try to get its
      // value.  This will configure the dependent keys if needed.
      if ((this[key] === undefined) && (key.indexOf('@') === 0)) {
        this.get(key) ;
      }

      if (target === this) target = null ; // use null for observers only.
      kvoKey = hub.keyFor('_kvo_observers', key);
      this._hub_kvo_for(kvoKey, hub.ObserverSet).add(target, method, context);
      this._hub_kvo_for('_kvo_observed_keys', hub.CoreSet).add(key) ;
    }

    if (this.didAddObserver) this.didAddObserver(key, target, method);
    return this;
  },

  /**
    Remove an observer you have previously registered on this object.  Pass
    the same key, target, and method you passed to addObserver() and your 
    target will no longer receive notifications.
    
    @returns {hub.Observable} reciever
  */
  removeObserver: function(key, target, method) {
    
    var kvoKey, chains, chain, observers, idx ;
    
    // normalize.  if a function is passed to target, make it the method.
    if (method === undefined) {
      method = target; target = this ;
    }
    if (!target) target = this ;
    if (hub.typeOf(method) === hub.T_STRING) method = target[method] ;
    if (!method) throw "You must pass a method to addObserver()" ;

    // if the key contains a '.', this is a chained observer.
    key = key.toString() ;
    if (key.indexOf('.') >= 0) {
      
      // try to find matching chains
      kvoKey = hub.keyFor('_kvo_chains', key);
      if (chains = this[kvoKey]) {
        
        // if chains have not been cloned yet, do so now.
        chains = this._hub_kvo_for(kvoKey) ;
        
        // remove any chains
        idx = chains.length;
        while(--idx >= 0) {
          chain = chains[idx];
          if (chain && (chain.masterTarget===target) && (chain.masterMethod===method)) {
            chains[idx] = chain.destroyChain() ;
          }
        }
      }
      
    // otherwise, just like a normal observer.
    } else {
      if (target === this) target = null ; // use null for observers only.
      kvoKey = hub.keyFor('_kvo_observers', key) ;
      if (observers = this[kvoKey]) {
        // if observers have not been cloned yet, do so now
        observers = this._hub_kvo_for(kvoKey) ;
        observers.remove(target, method) ;
        if (observers.targets <= 0) {
          this._hub_kvo_for('_kvo_observed_keys', hub.CoreSet).remove(key);
        }
      }
    }

    if (this.didRemoveObserver) this.didRemoveObserver(key, target, method);
    return this;
  },
  
  /**
    Returns true if the object currently has observers registered for a 
    particular key.  You can use this method to potentially defer performing
    an expensive action until someone begins observing a particular property
    on the object.
    
    @param {String} key key to check
    @returns {Boolean}
  */
  hasObserverFor: function(key) {
    hub.ObserverQueue.flush(this) ; // hookup as many observers as possible.
    
    var observers = this[hub.keyFor('_kvo_observers', key)],
        locals    = this[hub.keyFor('_kvo_local', key)],
        members ;

    if (locals && locals.length>0) return true ;
    if (observers && observers.getMembers().length>0) return true ;
    return false ;
  },

  /**
    This method will register any observers and computed properties saved on
    the object.  Normally you do not need to call this method youself.  It
    is invoked automatically just before property notifications are sent and
    from the init() method of hub.Object.  You may choose to call this
    from your own initialization method if you are using hub.Observable in
    a non-hub.Object-based object.
    
    This method looks for several private variables, which you can setup,
    to initialize:
    
      - _hub_observers: this should contain an array of key names for observers
        you need to configure.
        
      - _hub_properties: this should contain an array of key names for computed
        properties.
        
    @returns {Object} this
  */
  initObservable: function() {
    if (this._hub_observableInited) return ;
    this._hub_observableInited = true ;
    
    var loc, keys, key, value, observer, propertyPaths, propertyPathsLength ;
    
    // Loop through observer functions and register them
    if (keys = this._hub_observers) {
      var len = keys.length ;
      for(loc=0;loc<len;loc++) {
        key = keys[loc]; observer = this[key] ;
        propertyPaths = observer.propertyPaths ;
        propertyPathsLength = (propertyPaths) ? propertyPaths.length : 0 ;
        for(var ploc=0;ploc<propertyPathsLength;ploc++) {
          var path = propertyPaths[ploc] ;
          var dotIndex = path.indexOf('.') ;
          // handle most common case, observing a local property
          if (dotIndex < 0) {
            this.addObserver(path, this, observer) ;

          // next most common case, use a chained observer
          } else if (path.indexOf('*') === 0) {
            this.addObserver(path.slice(1), this, observer) ;
            
          // otherwise register the observer in the observers queue.  This 
          // will add the observer now or later when the named path becomes
          // available.
          } else {
            var root = null ;
            
            // handle special cases for observers that look to the local root
            if (dotIndex === 0) {
              root = this; path = path.slice(1) ;
            } else if (dotIndex===4 && path.slice(0,5) === 'this.') {
              root = this; path = path.slice(5) ;
            } else if (dotIndex<0 && path.length===4 && path === 'this') {
              root = this; path = '';
            }
            
            hub.ObserverQueue.addObserver(path, this, observer, root); 
          }
        }
      }
    }

    // Add Properties
    if (keys = this._hub_properties) {
      for(loc=0;loc<keys.length;loc++) {
        key = keys[loc];
        if (value = this[key]) {

          // activate cacheable only if needed for perf reasons
          if (value.isCacheable) this._hub_kvo_cacheable = true; 

          // register dependent keys
          if (value.dependentKeys && (value.dependentKeys.length>0)) {
            this.registerDependentKey(key, value.dependentKeys) ;
          }
        }
      }
    }
    
  },
  
  // ..........................................
  // NOTIFICATION
  // 

  /**
    Returns an array with all of the observers registered for the specified
    key.  This is intended for debugging purposes only.  You generally do not
    want to rely on this method for production code.
    
    @params key {String} the key to evaluate
    @returns {Array} array of Observer objects, describing the observer.
  */
  observersForKey: function(key) {
    var observers = this._hub_kvo_for('_kvo_observers', key) ;
    return observers.getMembers() || [] ;
  },
  
  // this private method actually notifies the observers for any keys in the
  // observer queue.  If you pass a key it will be added to the queue.
  _hub_notifyPropertyObservers: function(key) {

    if (!this._hub_observableInited) this.initObservable() ;
    
    hub.ObserverQueue.flush(this) ; // hookup as many observers as possible.

    var log = hub.LOG_OBSERVERS && !(this.LOG_OBSERVING===false) ;
    var observers, changes, dependents, starObservers, idx, keys, rev ;
    var members, membersLength, member, memberLoc, target, method, loc, func ;
    var context, spaces, cache ;

    if (log) {
      spaces = hub.KVO_SPACES = (hub.KVO_SPACES || '') + '  ' ;
      hub.debug([spaces, this].join(''), hub.fmt('notifying observers after change to key "%@"', key)) ;
    }
    
    // Get any starObservers -- they will be notified of all changes.
    starObservers =  this['_kvo_observers_*'] ;
    
    // prevent notifications from being sent until complete
    this._hub_kvo_changeLevel = (this._hub_kvo_changeLevel || 0) + 1; 

    // keep sending notifications as long as there are changes
    while(((changes = this._hub_kvo_changes) && (changes.length > 0)) || key) {
      
      // increment revision
      rev = ++this.propertyRevision ;
      
      // save the current set of changes and swap out the kvo_changes so that
      // any set() calls by observers will be saved in a new set.
      if (!changes) changes = hub.CoreSet.create() ;
      this._hub_kvo_changes = null ;

      // Add the passed key to the changes set.  If a '*' was passed, then
      // add all keys in the observers to the set...
      // once finished, clear the key so the loop will end.
      if (key === '*') {
        changes.add('*') ;
        changes.addEach(this._hub_kvo_for('_kvo_observed_keys', hub.CoreSet));

      } else if (key) changes.add(key) ;

      // Now go through the set and add all dependent keys...
      if (dependents = this._hub_kvo_dependents) {

        // NOTE: each time we loop, we check the changes length, this
        // way any dependent keys added to the set will also be evaluated...
        for(idx=0;idx<changes.length;idx++) {
          key = changes[idx] ;
          keys = dependents[key] ;
          
          // for each dependent key, add to set of changes.  Also, if key
          // value is a cacheable property, clear the cached value...
          if (keys && (loc = keys.length)) {
            if (log) hub.debug(hub.fmt("%@...including dependent keys for %@: %@", spaces, key, keys));
            cache = this._hub_kvo_cache;
            if (!cache) cache = this._hub_kvo_cache = {};
            while(--loc >= 0) {
              changes.add(key = keys[loc]);
              if (func = this[key]) {
                this[func.cacheKey] = undefined;
                cache[func.cacheKey] = cache[func.lastSetValueKey] = undefined;
              } // if (func=)
            } // while (--loc)
          } // if (keys && 
        } // for(idx...
      } // if (dependents...)

      // now iterate through all changed keys and notify observers.
      while(changes.length > 0) {
        key = changes.pop() ; // the changed key

        // find any observers and notify them...
        observers = this[hub.keyFor('_kvo_observers', key)];
        if (observers) {
          members = observers.getMembers() ;
          membersLength = members.length ;
          for(memberLoc=0;memberLoc < membersLength; memberLoc++) {
            member = members[memberLoc] ;
            if (member[3] === rev) continue ; // skip notified items.

            target = member[0] || this; 
            method = member[1] ; 
            context = member[2];
            member[3] = rev;
            
            if (log) hub.debug(hub.fmt('%@...firing observer on %@ for key "%@"', spaces, target, key));
            if (context !== undefined) {
              method.call(target, this, key, null, context, rev);
            } else {
              method.call(target, this, key, null, rev) ;
            }
          }
        }

        // look for local observers.  Local observers are added by hub.Object
        // as an optimization to avoid having to add observers for every 
        // instance when you are just observing your local object.
        members = this[hub.keyFor('_kvo_local', key)];
        if (members) {
          membersLength = members.length ;
          for(memberLoc=0;memberLoc<membersLength;memberLoc++) {
            member = members[memberLoc];
            method = this[member] ; // try to find observer function
            if (method) {
              if (log) hub.debug(hub.fmt('%@...firing local observer %@.%@ for key "%@"', spaces, this, member, key));
              method.call(this, this, key, null, rev);
            }
          }
        }
        
        // if there are starObservers, do the same thing for them
        if (starObservers && key !== '*') {          
          members = starObservers.getMembers() ;
          membersLength = members.length ;
          for(memberLoc=0;memberLoc < membersLength; memberLoc++) {
            member = members[memberLoc] ;
            target = member[0] || this; 
            method = member[1] ;
            context = member[2] ;
            
            if (log) hub.debug(hub.fmt('%@...firing * observer on %@ for key "%@"', spaces, target, key));
            if (context !== undefined) {
              method.call(target, this, key, null, context, rev);
            } else {
              method.call(target, this, key, null, rev) ;
            }
          }
        }

        // if there is a default property observer, call that also
        if (this.propertyObserver) {
          if (log) hub.debug(hub.fmt('%@...firing %@.propertyObserver for key "%@"', spaces, this, key));
          this.propertyObserver(this, key, rev) ;
        }
      } // while(changes.length>0)

      // changes set should be empty. release it for reuse
      if (changes) changes.destroy() ;
      
      // key is no longer needed; clear it to avoid infinite loops
      key = null ; 
      
    } // while (changes)
    
    // done with loop, reduce change level so that future sets can resume
    this._hub_kvo_changeLevel = (this._hub_kvo_changeLevel || 1) - 1; 
    
    if (log) hub.KVO_SPACES = spaces.slice(0, -2);
    
    return true ; // finished successfully
  },
  
  /**
    didChangeFor makes it easy for you to verify that you haven't seen any
    changed values.  You need to use this if your method observes multiple
    properties.  To use this, call it like this:
    
    if (this.didChangeFor('render','height','width')) {
       // DO SOMETHING HERE IF CHANGED.
    }
  */  
  didChangeFor: function(context) { 
    context = hub.hashFor(context) ; // get a hash key we can use in caches.
    
    // setup caches...
    var valueCache = this._hub_kvo_didChange_valueCache ;
    if (!valueCache) valueCache = this._hub_kvo_didChange_valueCache = {};
    var revisionCache = this._hub_kvo_didChange_revisionCache;
    if (!revisionCache) revisionCache=this._hub_kvo_didChange_revisionCache={};
    
    // get the cache of values and revisions already seen in this context
    var seenValues = valueCache[context] || {} ;
    var seenRevisions = revisionCache[context] || {} ;
    
    // prepare too loop!
    var ret = false ;
    var currentRevision = this._hub_kvo_revision || 0  ;
    var idx = arguments.length ;
    while(--idx >= 1) {  // NB: loop only to 1 to ignore context arg.
      var key = arguments[idx];
      
      // has the kvo revision changed since the last time we did this?
      if (seenRevisions[key] != currentRevision) {
        // yes, check the value with the last seen value
        var value = this.get(key) ;
        if (seenValues[key] !== value) {
          ret = true ; // did change!
          seenValues[key] = value;
        }
      }
      seenRevisions[key] = currentRevision;
    }
    
    valueCache[context] = seenValues ;
    revisionCache[context] = seenRevisions ;
    return ret ;
  },

  /**
    Sets the property only if the passed value is different from the
    current value.  Depending on how expensive a get() is on this property,
    this may be more efficient.
    
    @param key {String} the key to change
    @param value {Object} the value to change
    @returns {hub.Observable}
  */
  setIfChanged: function(key, value) {
    return (this.get(key) !== value) ? this.set(key, value) : this ;
  },
  
  /**
    Navigates the property path, returning the value at that point.
    
    If any object in the path is undefined, returns undefined.
  */
  getPath: function(path) {
    var tuple = hub.tupleForPropertyPath(path, this) ;
    if (tuple === null || tuple[0] === null) return undefined ;
    return tuple[0].get(tuple[1]) ;
  },
  
  /**
    Navigates the property path, finally setting the value.
    
    @param path {String} the property path to set
    @param value {Object} the value to set
    @returns {hub.Observable}
  */
  setPath: function(path, value) {
    if (path.indexOf('.') >= 0) {
      var tuple = hub.tupleForPropertyPath(path, this) ;
      if (!tuple || !tuple[0]) return null ;
      tuple[0].set(tuple[1], value) ;
    } else this.set(path, value) ; // shortcut
    return this;
  },

  /**
    Navigates the property path, finally setting the value but only if 
    the value does not match the current value.  This will avoid sending
    unecessary change notifications.
    
    @param path {String} the property path to set
    @param value {Object} the value to set
    @returns {Object} this
  */
  setPathIfChanged: function(path, value) {
    if (path.indexOf('.') >= 0) {
      var tuple = hub.tupleForPropertyPath(path, this) ;
      if (!tuple || !tuple[0]) return null ;
      if (tuple[0].get(tuple[1]) !== value) {
        tuple[0].set(tuple[1], value) ;
      }
    } else this.setIfChanged(path, value) ; // shortcut
    return this;
  },
  
  /** 
    Convenience method to get an array of properties.
    
    Pass in multiple property keys or an array of property keys.  This
    method uses getPath() so you can also pass key paths.

    @returns {Array} Values of property keys.
  */
  getEach: function() {
    var keys = hub.A(arguments) ;
    var ret = [];
    for(var idx=0; idx<keys.length;idx++) {
      ret[ret.length] = this.getPath(keys[idx]);
    }
    return ret ;
  },
  
  
  /**  
    Increments the value of a property.
    
    @param key {String} property name
    @returns {Number} new value of property
  */
  incrementProperty: function(key) { 
    this.set(key,(this.get(key) || 0)+1); 
    return this.get(key) ;
  },

  /**  
    decrements a property
    
    @param key {String} property name
    @returns {Number} new value of property
  */
  decrementProperty: function(key) {
    this.set(key,(this.get(key) || 0) - 1 ) ;
    return this.get(key) ;
  },

  /**  
    Inverts a property.  Property should be a bool.
    
    @param key {String} property name
    @param value {Object} optional parameter for "true" value
    @param alt {Object} optional parameter for "false" value
    @returns {Object} new value
  */
  toggleProperty: function(key,value,alt) { 
    if (value === undefined) value = true ;
    if (alt === undefined) alt = false ;
    value = (this.get(key) == value) ? alt : value ;
    this.set(key,value);
    return this.get(key) ;
  },

  /**
    Convenience method to call propertyWillChange/propertyDidChange.
    
    Sometimes you need to notify observers that a property has changed value 
    without actually changing this value.  In those cases, you can use this 
    method as a convenience instead of calling propertyWillChange() and 
    propertyDidChange().
    
    @param key {String} The property key that has just changed.
    @param value {Object} The new value of the key.  May be null.
    @returns {hub.Observable}
  */
  notifyPropertyChange: function(key, value) {
    this.propertyWillChange(key) ;
    this.propertyDidChange(key, value) ;
    return this; 
  },
  
  /**  
    Notifies all of observers of a property changes.
    
    Sometimes when you make a major update to your object, it is cheaper to
    simply notify all observers that their property might have changed than
    to figure out specifically which properties actually did change.
    
    In those cases, you can simply call this method to notify all property
    observers immediately.  Note that this ignores property groups.
    
    @returns {hub.Observable}
  */
  allPropertiesDidChange: function() {
    this._hub_kvo_cache = null; //clear cached props
    this._hub_notifyPropertyObservers('*') ;
    return this ;
  },

  addProbe: function(key) { this.addObserver(key,hub.logChange); },
  removeProbe: function(key) { this.removeObserver(key,hub.logChange); },

  /**
    Logs the named properties hub.debug.
    
    @param {String...} propertyNames one or more property names
  */
  logProperty: function() {
    var props = hub.A(arguments) ;
    for(var idx=0;idx<props.length; idx++) {
      var prop = props[idx] ;
      hub.debug(hub.fmt('%@:%@', hub.guidFor(this), prop), this.get(prop)) ;
    }
  },

  propertyRevision: 1
    
} ;

/** @private used by addProbe/removeProbe */
hub.logChange = function logChange(target, key, value) {
  hub.debug(hub.fmt("CHANGE", "%@[%@] => %@", target, key, target.get(key))) ;
};

// Make all Array's observable
hub.mixin(Array.prototype, hub.Observable) ;
