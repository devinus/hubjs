// ==========================================================================
// Project:   hub.js - cloud-friendly object graph sync
// Copyright: ©2010 Erich Ocean.
//            Portions ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple Inc. All rights reserved.
// License:   Licensed under an MIT license (see license.js).
// ==========================================================================
/*globals GLOBAL hub module test ok equals same */

var store, Application, dataSource;

module("hub.Store Core Methods", {
  setup: function() {
    dataSource = hub.DataSource.create({ 
      
      gotParams: false,
      
      updateRecord: function(store, storeKey, params) {
        this.gotParams = params && params['param1'] ? true: false;
      }
    });
    
    Application = {};
    Application._hub_nameDidChange = 0;
    
    Application.File = hub.Record.extend({ 
      
      nameDidChange: function(object, key) {
        Application._hub_nameDidChange++;
      }.observes('name', 'url', 'isDirectory')
      
    });
    Application.FileDisk = hub.Record.extend({ });
    
    Application.Data = {
      
      "FileDisk": [
        { id: '14', name: 'Main Drive', parent: null, children: null }
      ],
    
      "File": [
        { id: '10', name: 'Home', url: '/emily_parker', isDirectory: true, parent: null, children: 'Collection'},
        { id: '11', name: 'Documents', fileType: 'documents', url: '/emily_parker/Documents', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false},
        { id: '137',name: 'Library', fileType: 'library', url: '/emily_parker/Library', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false},
        { id: '12', name: 'Movies', fileType: 'movies', url: '/emily_parker/Movies', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true},
        { id: '134',name: 'Music', fileType: 'music', url: '/emily_parker/Music', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true},
        { id: '135',name: 'Pictures', fileType: 'pictures', url: '/emily_parker/Pictures', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true},
        { id: '13', name: 'Auto Insurance', fileType: 'folder', url: '/emily_parker/Documents/Auto%20Insurance', isDirectory: true, parent: '11', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false},
        { id: '14', name: 'Birthday Invitation.pdf', fileType: 'file', url: '/emily_parker/Documents/Birthday%20Invitation', isDirectory: false, parent: '11', createdAt: 'October 17, 2007', modifiedAt: 'October 21, 2007', filetype: 'pdf', isShared: false},
        { id: '136', name: 'Software', fileType: 'software', url: '/emily_parker/Software', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true}
      ]
    };
    
    
    store = hub.Store.create({ name: 'Test store'} ).from(dataSource);
    for(var i in Application.Data) {
      store.loadRecords(Application[i], Application.Data[i]);
    }
    
    
    // make sure RecordType by String can map
    GLOBAL.Application = Application;
  }    
});

test("Verify that hub.Store's toString() includes the store's name, if it was specified", function() {
  
  var description = store.toString();
  ok(description.indexOf('Test store') !== -1, 'should contain "Test store"');
  
});

test("Verify loadRecords() loads data", function() {
  
  equals(store.find(Application.File, '14').get('name'), 'Birthday Invitation.pdf', 'should return File 14');
  equals(store.find(Application.FileDisk, '14').get('name'), 'Main Drive', 'should return FileDisk 14');
  
});

test("Verify storeKeys() gets all store keys", function() {
  
  var storeKey;
  
  equals(store.storeKeys().length, 10, 'Length should be 10');
  
  storeKey = store.storeKeyFor(Application.File, '10');
  store.writeStatus(storeKey, hub.Record.EMPTY);
  equals(store.storeKeys().length, 9, 'Length should be one less now');
  
});

test("find() should take both hub.Record object and hub.Record string as recordtype argument", function() {
  
  equals(store.find('Application.File', '14').get('name'), 'Birthday Invitation.pdf', 'should return File 14');
  equals(store.find(Application.File, '14').get('name'), 'Birthday Invitation.pdf', 'should return FileDisk 14');
  
});

// test("loading more records should not sending _flushRecordChanges() until the end of the runloop", function() {
// 
//   var moreData = [
//       { id: '55', name: 'Home', url: '/emily_parker', isDirectory: true, parent: null, children: 'Collection'},
//       { id: '56', name: 'Documents', fileType: 'documents', url: '/emily_parker/Documents', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false},
//       { id: '57',name: 'Library', fileType: 'library', url: '/emily_parker/Library', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false}
//   ];
//   
//   
//   
//   var storeKeys = store.loadRecords(Application.File, moreData);
//   equals(storeKeys.length, 3, 'precon - should have loaded three records');
//   equals(store.recordPropertyChanges.storeKeys.length, 3, 'should be three storeKeys in changelog');
//   
//   
//   
//   // recordPropertyChanges may not exist after notifications have gone out.
//   // treat that like having len=0
//   var changes = store.recordPropertyChanges;
//   var len = (changes && changes.storeKeys) ? changes.storeKeys.length : 0;
//   equals(len, 0, 'should be zero storeKeys in changelog');
//   
// });

test("Passing params through commitRecords()", function() {
  
  var file = store.find(Application.File, '14');
  file.set('name', 'My Great New Name');
  
  store.commitRecords(null, null, null, { param1: 'value1' });
  
  equals(dataSource.gotParams, true, 'params should have travelled through to dataSource updateRecord() call');
  
});

test("Make sure that setting an attribute on a record will only notify respective observers once", function() {
  
  var file = store.find(Application.File, '14');
  Application._hub_nameDidChange = 0 ;
  
  
  file.writeAttribute('name', 'My Great New Name');
  
  
  equals(Application._hub_nameDidChange, 1, 'observer was only fired once');

});
