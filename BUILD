# An ordered list of files in ../src that are concatenated to produce hub.js, 
# one file per line. Lines beginning with # are skipped. On node.js, the 
# index.js file uses the contents of this file to assemble hub.js dynamically 
# during development.
# 
# To generate a custom build of hub.js, modify this BUILD file to include the 
# list of files you need/want in the correct order.
# 
# NOTE: In a production build, lines matching /^development[/].*/ will be 
# skipped, and calls to hub_assert(), hub_precondition(), hub_postconditon(), 
# hub_invariant(), and hub_error() will be removed from the code completely. 
# Use hub.allege() when you want an assertion to remain in production code 
# (e.g. because the test condition has a side effect and so you only want to 
# execute the test once in development).

license.js
bootstrap.js
development/assert.js
core.js
private/observer_set.js
mixins/observable.js
system/enumerator.js
mixins/enumerable.js
system/range_observer.js

# NOTE: hub.Observable also enhances the built-in JavaScript Array.  Make sure 
# hub.Array is evaluated after hub.Observable so the hub.Array version of 
# unknownProperty() on Array is used.
mixins/array.js

mixins/copyable.js
mixins/delegate_support.js
mixins/freezable.js
system/set.js
system/object.js
private/chain_observer.js
private/observer_queue.js
system/error.js
system/index_set.js
system/sparse_array.js


data_sources/data_source.js
data_sources/cascade.js
records/record.js
development/fixtures.js
records/record_attribute.js
records/fetched_attribute.js
records/many_attribute.js
records/single_attribute.js
system/many_array.js
system/store.js
mixins/child_store.js
system/editing_context.js
system/query.js
system/record_array.js


utils/uuid.js
utils/sha256.js
utils/buzhash.js
utils/base64.js
system/database.js
system/hub.js
system/merge_hub.js
