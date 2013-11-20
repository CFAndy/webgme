/*
 * Copyright (C) 2012 Vanderbilt University, All rights reserved.
 * 
 * Author: Miklos Maroti
 */

define([ "util/assert", "core/core", "core/tasync" ], function(ASSERT, Core, TASYNC) {
	"use strict";

	// ----------------- CoreType -----------------

	var CoreType = function(oldcore) {
		// copy all operations
		var core = {};
		for ( var key in oldcore) {
			core[key] = oldcore[key];
		}

		// ----- validity

		function __test(text, cond) {
			if (!cond) {
				throw new Error(text);
			}
		}

		function isValidNode(node) {
			try {
				__test("core", oldcore.isValidNode(node));
				__test("base", typeof node.base === "object");
				return true;
			} catch (error) {
				console.log("Wrong node", error.stack);
				return false;
			}
		}

        function isFalseNode(node) {
            //TODO this hack should be removed, but now it seems just fine :)
            if(typeof oldcore.getPointerPath(node,"base") === "undefined"){
                return true;
            }
            return false;
        }

		core.isValidNode = isValidNode;

		// ----- navigation

		core.getBase = function(node) {
			ASSERT(isValidNode(node));

			// TODO: check if base has moved
			return node.base;
		};

		core.loadRoot = function(hash) {
			return TASYNC.call(__loadRoot2, oldcore.loadRoot(hash));
		};

		function __loadRoot2(node) {
            ASSERT(typeof node.base === "undefined" || node.base === null); //kecso - TODO it should be undefined, but maybe because of the cache it can be null

			node.base = null;
			return node;
		}

        core.loadChild = function(node,relid){
            var child = TASYNC.call(__loadBase,oldcore.loadChild(node,relid));
            var base = core.getBase(node);
            var basechild = null;
            if(base){
                basechild = TASYNC.call(__loadBase,oldcore.loadChild(base,relid));
            }
            return TASYNC.call(function(ch,bch,n,r){
                var done = null;
                if(ch === null){
                    if(bch !== null){
                        ch = core.createNode({base:bch,parent:n,relid:r});
                        done = core.persist(core.getRoot(n));
                    }
                }
                return TASYNC.call(function(child){return child;},ch,done);
            },child,basechild,node,relid);
        };

		core.loadByPath = function(node, path) {
			ASSERT(isValidNode(node));
			return TASYNC.call(__loadBase, oldcore.loadByPath(node, path));
		};

		/*core.loadPointer = function(node, name) {
			ASSERT(isValidNode(node));
			return TASYNC.call(__loadBase, oldcore.loadPointer(node, name));
		};*/
        core.loadPointer = function(node,name){
            var pointer = TASYNC.call(__loadBase,oldcore.loadPointer(node, name));
            var base = core.getBase(node);
            var basepointer = null;
            if(base){
                basepointer = TASYNC.call(__loadBase,oldcore.loadPointer(base, name));
            }
            return TASYNC.call(function(p,bp,n,nm){
                var done = null;
                if(p === null){
                    if(bp !== null){
                        core.setPointer(n,nm,bp);
                        done = core.persist(core.getRoot(n));
                        p = bp;
                    }
                }
                return TASYNC.call(function(pointer){return pointer;},p,done);
            },pointer,basepointer,node,relid);
        };

		function __loadBase(node) {
			ASSERT(typeof node.base === "undefined" || typeof node.base === "object");

			if (typeof node.base === "undefined") {
                if(isFalseNode(node)){
                    var root = core.getRoot(node);
                    core.deleteNode(node);
                    return TASYNC.call(function(){return null;},core.persist(root));
                } else {
                    return TASYNC.call(__loadBase2, node, oldcore.loadPointer(node, "base"));
                }
			} else {
                var oldpath = core.getPath(node.base);
                var newpath = core.getPointerPath(node,"base");
                if(oldpath !== newpath){
                    delete node.base;
                    return __loadBase(node);
                } else {
                    return node;
                }
			}
		}

		function __loadBase2(node, target) {
			ASSERT(typeof node.base === "undefined" || node.base === null); //kecso

            if(target === null){
                node.base = null;
                return node;
            } else {
                return TASYNC.call(function(n,b){n.base = b; return n;},node,__loadBase(target));
            }
		}

        core.getChildrenRelids = function(node){
            var inheritRelIds = node.base === null ? [] : oldcore.getChildrenRelids(core.getBase(node));
            var ownRelIds = oldcore.getChildrenRelids(node);
            for(var i=0;i<inheritRelIds.length;i++){
                if(ownRelIds.indexOf(inheritRelIds[i]) === -1){
                    ownRelIds.push(inheritRelIds[i]);
                }
            }
            return ownRelIds;
        };
        
        core.loadChildren = function(node) {
            ASSERT(isValidNode(node));
            var relids = core.getChildrenRelids(node);
            var children = [];
            for(var i = 0; i< relids.length; i++)
                children[i] = core.loadChild(node,relids[i]);
            return TASYNC.call(function(n){
                var newn = [];
                for(var i=0; i<n.length;i++){
                    if(n[i] !== null){
                        newn.push(n[i]);
                    }
                }
                return newn;
            },TASYNC.lift(children));
        };


        core.loadCollection = function(node, name) {
			ASSERT(isValidNode(node));
			return TASYNC.call(__loadBaseArray, oldcore.loadCollection(node, name));
		};

		function __loadBaseArray(nodes) {
			ASSERT(nodes instanceof Array);

			for ( var i = 0; i < nodes.length; ++i)
				nodes[i] = __loadBase(nodes[i]);

			return TASYNC.call(function(n){
                var newn = [];
                for(var i=0; i<n.length;i++){
                    if(n[i] !== null){
                        newn.push(n[i]);
                    }
                }
                return newn;
            },TASYNC.lift(nodes));
		}

		// ----- creation

		core.createNode = function(parameters) {
			parameters = parameters || {};
			var base = parameters.base || null,
				parent = parameters.parent;


			ASSERT(!parent || isValidNode(parent));
			ASSERT(!base || isValidNode(base));

			var node = oldcore.createNode(parameters);
            node.base = base;
            oldcore.setPointer(node,"base",base);

			return node;
		};

		// ----- properties

		core.getAttributeNames = function(node) {
			ASSERT(isValidNode(node));

			var merged = {};
			do {
				var names = oldcore.getAttributeNames(node);
				for ( var i = 0; i < names.length; ++i) {
					if (!(names[i] in merged)) {
						merged[names[i]] = true;
					}
				}

				node = node.base;
			} while (node);

			return Object.keys(merged);
		};

		core.getRegistryNames = function(node) {
			ASSERT(isValidNode(node));

			var merged = {};
			do {
				var names = oldcore.getRegistryNames(node);
				for ( var i = 0; i < names.length; ++i) {
					if (!(names[i] in merged)) {
						merged[names[i]] = true;
					}
				}

				node = node.base;
			} while (node);

			return Object.keys(merged);
		};

		core.getAttribute = function(node, name) {
			ASSERT(isValidNode(node));
            var value;
			do {
				value = oldcore.getAttribute(node, name);
				node = node.base;
			} while (typeof value === "undefined" && node !== null);

			return value;
		};

		core.getRegistry = function(node, name) {
			ASSERT(isValidNode(node));
            var value;
			do {
				value = oldcore.getRegistry(node, name);
				node = node.base;
			} while (typeof value === "undefined" && node !== null);

			return value;
		};

		// ----- pointers

		core.getPointerNames = function(node) {
			ASSERT(isValidNode(node));

			var merged = {};
			do {
				var names = oldcore.getPointerNames(node);
				for ( var i = 0; i < names.length; ++i) {
					if (!(names[i] in merged)) {
						merged[names[i]] = true;
					}
				}

				node = node.base;
			} while (node);

			return Object.keys(merged);
		};

		core.getPointerPath = function(node, name) {
			ASSERT(isValidNode(node));
            var value;
			do {
				value = oldcore.getPointerPath(node, name);
				node = node.base;
			} while (typeof value === "undefined" && node !== null);

			return value;
		};

        // -------- kecso
        core.setBase = function(node,base){
            ASSERT(isValidNode(node) && (isValidNode(base) || base === undefined || base === null));
            if(!!base){
                oldcore.setPointer(node, "base", base);
                //TODO maybe this is not the best way, needs to be double checked
                node.base = base;
            } else {
                oldcore.delPointer(node,'base');
                delete node.base;
            }
        };

        core.getChild = function(node,relid){
            ASSERT(isValidNode(node) && (typeof node.base === 'undefined' || typeof node.base === 'object'));
            var child = oldcore.getChild(node,relid);
            if(node.base !== null && node.base !== undefined){
                if(child.base === null || child.base === undefined){
                    child.base = core.getChild(node.base,relid);
                }
            } else {
                child.base = null;
            }
            return child;
        };
        core.moveNode = function(node,parent){
            var base = node.base;
            var moved = oldcore.moveNode(node,parent);
            moved.base = base;
            return moved;
        };
        core.copyNode = function(node,parent){
            var base = node.base;
            var newnode = oldcore.copyNode(node,parent);
            newnode.base = base;
            return newnode;
        };
        // -------- kecso

		return core;
	};

	return CoreType;
});
