// ==========================================================================
// Project:   hub.js - cloud-friendly object graph sync
// Copyright: ©2010 Erich Ocean.
//            Portions ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple Inc. All rights reserved.
// License:   Licensed under an MIT license (see license.js).
// ==========================================================================
/*globals hub module test ok equals same */

// NOTE: The test below are based on the Data Hashes state chart.  This models
// the "write" event in the NestedStore portion of the diagram.

var store, child, storeKey, json;
module("hub.Store#writeDataHash", {
  setup: function() {
    store = hub.Store.create();
    
    json = {
      string: "string",
      number: 23,
      bool:   true
    };
    
    storeKey = hub.Store.generateStoreKey();
    child = store.createEditingContext();
  }
});

// ..........................................................
// BASIC STATE TRANSITIONS
// 

// The transition from each base state performs the same operation, so just
// run the same test on each state.
function testWriteDataHash() {
  var oldrev = store.revisions[storeKey];
  
  // perform test
  var json2 = { foo: "bar" };
  equals(store.writeDataHash(storeKey, json2, hub.Record.READY_NEW), store, 'should return receiver');
  
  // verify
  equals(store.storeKeyEditState(storeKey), hub.Store.EDITABLE, 'new edit state should be editable');
  
  equals(store.readDataHash(storeKey), json2, 'should have new json data hash');
  equals(store.readStatus(storeKey), hub.Record.READY_NEW, 'should have new status');

  equals(store.revisions[storeKey], oldrev, 'should not change revision');
  if (!hub.none(oldrev)) {
    ok(store.revisions.hasOwnProperty(storeKey), 'should clone reference to revision');
  }
}


test("edit state=LOCKED - also writes a NEW hash", function() {
  
  // test preconditions
  equals(store.storeKeyEditState(storeKey), hub.Store.LOCKED, 'precond - edit state should be locked');
  
  testWriteDataHash();
});

test("edit state=EDITABLE - also overwrites an EXISTING hash", function() {
  
  // test preconditions
  store.writeDataHash(storeKey, { foo: "bar" });
  equals(store.storeKeyEditState(storeKey), hub.Store.EDITABLE, 'precond - edit state should be editable');
  
  testWriteDataHash();

});

// ..........................................................
// PROPOGATING TO NESTED STORES
// 

test("change should propogate to child if child edit state = INHERITED", function() {

  // verify preconditions
  equals(child.storeKeyEditState(storeKey), hub.Store.INHERITED, 'precond - child edit state should be INHERITED');

  // perform change
  var json2 = { version: 2 };
  store.writeDataHash(storeKey, json2, hub.Record.READY_NEW);
  
  // verify
  same(child.readDataHash(storeKey), json2, 'child should pick up change');
  equals(child.readStatus(storeKey), hub.Record.READY_NEW, 'child should pick up new status');
});


function testLockedOrEditableChild() {
  // perform change
  var json2 = { version: 2 };
  store.writeDataHash(storeKey, json2, hub.Record.READY_NEW);
  
  // verify
  same(child.readDataHash(storeKey), json, 'child should NOT pick up change');
  equals(child.readStatus(storeKey), hub.Record.READY_CLEAN, 'child should pick up new status');
}


test("change should not propogate to child if child edit state = LOCKED", function() {
  store.writeDataHash(storeKey, json, hub.Record.READY_CLEAN);
  store.editables = null ; // clear to simulate locked mode.
  
  // verify preconditions
  child.readDataHash(storeKey);
  equals(child.storeKeyEditState(storeKey), hub.Store.LOCKED, 'precond - child edit state should be LOCKED');

  testLockedOrEditableChild();
});

test("change should not propogate to child if child edit state = EDITABLE", function() {
  store.writeDataHash(storeKey, json, hub.Record.READY_CLEAN);
  store.editables = null ; // clear to simulate locked mode.

  // verify preconditions
  child.readEditableDataHash(storeKey);
  equals(child.storeKeyEditState(storeKey), hub.Store.EDITABLE, 'precond - child edit state should be EDITABLE');

  testLockedOrEditableChild();
});
