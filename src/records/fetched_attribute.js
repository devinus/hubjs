// ==========================================================================
// Project:   hub.js - cloud-friendly object graph sync
// Copyright: ©2010 Erich Ocean.
//            Portions ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple Inc. All rights reserved.
// License:   Licensed under an MIT license (see license.js).
// ==========================================================================
/*global hub */

/**
  Describes a single attribute that is fetched dynamically from the server
  when you request it.  Normally getting a property value with this attribute
  applied will cause call the find() method on the record store passing
  the attribute record type as the query key along with the property value,
  owner record, and property key name as parameters. 
  
  The DataSource you hook up to your store must know how to load this kind 
  of relationship for this fetched property to work properly.
  
  The return value is usually an hub.RecordArray that will populate with the
  record data so that you can display it.
  
  @class
  @extends hub.RecordAttribute
*/
hub.FetchedAttribute = hub.RecordAttribute.extend(
  /** @scope hub.FetchedAttribute.prototype */ {

  /**
    Define the param key that will be passed to the findAll method on the
    store.  If null, the param will not be send.  Defaults to 'link'
    
    @property {String}
  */
  paramValueKey: 'link',

  /**
    Define the param key used to send the parent record.  If null the param
    will not be sent.  Defaults to 'owner'.
    
    @property {String}
  */
  paramOwnerKey: 'owner',
  
  /**
    Define the param key used to send the key name used to reference this 
    attribute.  If null, the param will not be sent.  Defaults to "rel"
    
    @property {String}
  */
  paramRelKey: 'rel',
  
  /**
    Optional query key to pass to findAll.  Otherwise type class will be 
    passed.
    
    @property {String}
  */
  queryKey: null,

  /** 
    Fetched attributes are not editable 
    
    @property {Boolean}
  */
  isEditable: false,  
  
  // ..........................................................
  // LOW-LEVEL METHODS
  // 
  
  /**  @private - adapted for fetching. do findAll */
  toType: function(record, key, value) {
    var store = record.get('store');
    if (!store) return null ; // nothing to do
    
    var paramValueKey = this.get('paramValueKey'),
        paramOwnerKey = this.get('paramOwnerKey'),
        paramRelKey   = this.get('paramRelKey'),
        queryKey      = this.get('queryKey') || this.get('typeClass'),
        params        = {};

    // setup params for query
    if (paramValueKey) params[paramValueKey] = value ;
    if (paramOwnerKey) params[paramOwnerKey] = record ;
    if (paramRelKey)   params[paramRelKey]   = this.get('key') || key ;
    
    // make request - should return hub.RecordArray instance
    return store.findAll(queryKey, params);
  },

  /** @private - fetched attributes are read only. */
  fromType: function(record, key, value) {
    return value;
  }
  
});
