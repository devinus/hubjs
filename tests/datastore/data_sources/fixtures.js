// ==========================================================================
// Project:   hub.js - cloud-friendly object graph sync
// Copyright: ©2010 Erich Ocean.
//            Portions ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple Inc. All rights reserved.
// License:   Licensed under an MIT license (see license.js).
// ==========================================================================
/*globals GLOBAL hub module ok equals same test MyApp Sample */

var store, fds, storeKey1,storeKey2;

module("hub.FixturesDataSource", {
  setup: function() {
    var Sample = (GLOBAL.Sample= hub.Object.create());
    Sample.File = hub.Record.extend({ test:'hello'});

    // files
    Sample.File.FIXTURES = [
    { id: '10', name: 'Home', url: '/emily_parker', isDirectory: true, parent: null, children: 'Collection'},
    { id: '11', name: 'Documents', fileType: 'documents', url: '/emily_parker/Documents', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false},
    { id: '137',name: 'Library', fileType: 'library', url: '/emily_parker/Library', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false},
    { id: '12', name: 'Movies', fileType: 'movies', url: '/emily_parker/Movies', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true},
    { id: '134',name: 'Music', fileType: 'music', url: '/emily_parker/Music', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true},
    { id: '135',name: 'Pictures', fileType: 'pictures', url: '/emily_parker/Pictures', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true},
    { id: '13', name: 'Auto Insurance', fileType: 'folder', url: '/emily_parker/Documents/Auto%20Insurance', isDirectory: true, parent: '11', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'October 21, 2007', filetype: 'directory', isShared: false},
    { id: '150', name: 'Birthday Invitation.pdf', fileType: 'file', url: '/emily_parker/Documents/Birthday%20Invitation', isDirectory: false, parent: '11', createdAt: 'October 17, 2007', modifiedAt: 'October 21, 2007', filetype: 'pdf', isShared: false},
    { id: '136', name: 'Software', fileType: 'software', url: '/emily_parker/Software', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true}
    ];
    
    store = hub.Store.create().from(hub.Record.fixtures);
  }
});

test("Verify find() loads all fixture data", function() {

  var result = store.find(Sample.File),
      rec, storeKey, dataHash;
  
  ok(result, 'should return a result');
  equals(result.get('length'), Sample.File.FIXTURES.get('length'), 'should return records for each item in FIXTURES');
  
  // verify storeKeys actually return Records
  var idx, len = result.get('length'), expected = [];
  for(idx=0;idx<len;idx++) {
    rec = result.objectAt(idx);
    storeKey = rec ? rec.get('storeKey') : null;
    dataHash = storeKey ? store.readDataHash(storeKey) : null;

    ok(!!dataHash, hub.fmt('storeKey at result[%@] (%@) should return dataHash', idx, storeKey));
    
    expected.push(rec); // save record for later test
  }
  
  // verify multiple calls to findAll() returns SAME data
  result = store.find(Sample.File);
  
  equals(result.get('length'), expected.length, 'second result should have same length as first');
  len = result.get('length');
  for(idx=0;idx<len;idx++) {
    rec = result.objectAt(idx);
    equals(rec, expected[idx], hub.fmt('record returned at index %@ should be same as previous', idx));
  }
});

test("Verify find() loads data from store", function() {
  var sk=store.find(Sample.File, "150");
  equals(sk.get('name'), 'Birthday Invitation.pdf', 'returns record should have name from fixture');
});


test("Destroy a record and commit", function() {
  var ret      = store.find(Sample.File, "136"),
      storeKey = ret.get('storeKey'),
      fixtures = store.get('dataSource');
      
  ok(ret, 'precond - must have record in store');
  ok(fixtures.fixtureForStoreKey(store, storeKey), 'precond - fixtures should have data for record');
  
  store.destroyRecord(Sample.File, "136");
  store.commitRecords();
  ok(!fixtures.fixtureForStoreKey(store, storeKey), 'fixtures should no longer have data for record');
});

test("Create a record and commit it", function() {

  var fixtures = store.get('dataSource'),
      dataHash = { id: '200', name: 'Software', fileType: 'software', url: '/emily_parker/Software', isDirectory: true, parent: '10', children: 'Collection', createdAt: 'June 15, 2007', modifiedAt: 'June 15, 2007', filetype: 'directory', isShared: true, sharedAt: 'October 15, 2007', sharedUntil: 'March 31, 2008', sharedUrl: '2fhty', isPasswordRequired: true },
      storeKey ;
  
  store.createRecord(Sample.File, dataHash) ;
  store.commitRecords();

  storeKey = Sample.File.storeKeyFor(dataHash.id);
  ok(fixtures.fixtureForStoreKey(store, storeKey), 'should have data hash in fixtures');
});


test("Update and commit a record", function() {

  var rec      = store.find(Sample.File, "10"),
      storeKey = Sample.File.storeKeyFor("10"),
      fixtures = store.get('dataSource'), 
      fixture = fixtures.fixtureForStoreKey(store, storeKey);

  equals(fixture.name, rec.get('name'), 'precond - fixture state should match name');

  rec.set('name', 'foo');
  store.commitRecords();
  
  fixture = fixtures.fixtureForStoreKey(store, storeKey);
  equals(fixture.name, rec.get('name'), 'fixture state should update to match new name');
    
});
