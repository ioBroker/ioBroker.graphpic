/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";
var utils   = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = utils.adapter('graphpic');
var request = require('request');
var express = require('express');

var app           = express(); // express server
var server        = null;      // http server
var pingTimeout   = null;      // timer to monitor pings
var pingLastCheck = null;      // When last ping was received
var oldObjects    = null;      // array with old objects to synchronise
var objects       = {};        // object with actual objects
var subscribes    = [];
var inited        = false;     // if init string sent to graphpic
var cutLength;
var initString;
var gpServerPort  = null;		 
var gpServer      = 'localhost';
var socket        = null;

adapter.on('ready', function () {
        main();
        adapter.subscribeStates('*');
    })
    .on('stateChange', function (id, state) {
        if (state && !state.ack && id) {
            cutLength = cutLength || (adapter.namespace.length + 1);
            id = id.substring(cutLength);
            if (objects[id]) {
                if (objects[id].common.write) {
                    setTimeout(function () {
                        gpWriteVar(id, state);
                    }, 0);
                } else {
                    adapter.log.warn('Cannot write read-only state "' + id + '"');
                }
            } else {
                adapter.log.error('State "' + id + '" does not exist');
            }
        }
    }).on('message', function (obj) {
        processMessage(obj);
    });

process.on('SIGINT', function () {
    if (adapter && adapter.setState) {
        checkPing(true);
        if (server) {
            server.close();
        }
        adapter.setState('info.connection', false, true);
        inited = false;
    }
});

function processMessage(msg) {
    if (msg.command === 'subscribe') {
        if (typeof msg.message === 'object') {
            gpSubscribe(msg.message.id, function (err) {
                adapter.sendTo(msg.from, msg.command, err, msg.callback);
            });
        } else {
            gpSubscribe(msg.message, function (err) {
                adapter.sendTo(msg.from, msg.command, err, msg.callback);
            });
        }
    } else if (msg.command === 'unsubscribe') {
        if (typeof msg.message === 'object') {
            gpUnsubscribe(msg.message.id, function (err) {
                adapter.sendTo(msg.from, msg.command, err, msg.callback);
            });
        } else {
            gpUnsubscribe(msg.message, function (err) {
                adapter.sendTo(msg.from, msg.command, err, msg.callback);
            });
        }
    }
}

function resubscribeAll(index, callback) {
    index = index || 0;
    if (index >= subscribes.length) {
        callback && callback();
        return;
    }
    gpSubscribe(subscribes[index], function () {
        setTimeout(function () {
            resubscribeAll(index + 1, callback);
        }, 0)
    }, true);
}

// Functions to communicate with graphPic
function gpWriteVar(id, state, callback) {
 /*   var options = {
        method: 'post',
        body: state.val.toString(),
        url: adapter.config.connectionLink + '/api/set/' + objects[id].native.group + '/' + objects[id].native.item
    };

    request(options, function (error, response, body) {
        if (error || response.statusCode !== 200 || body !== '"ok"') {
            adapter.log.error('gpWriteVar: ' + error);
            callback && callback(error || response.statusCode || body);
        } else {
            callback && callback();
        }
    });
	*/
	//tcp
	gpSetVar(id, state, callback);
}

function gpRequestGroups(callback) {
    request(adapter.config.connectionLink + '/api/groups', function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var data = null;
            try {
                data = JSON.parse(body);
            } catch (error) {
                adapter.log.error('gpRequestGroups: cannot parse response - ' + error);
            }
            callback && callback(error, data);
        } else {
            adapter.log.error('gpRequestGroups: ' + error);
            callback && callback(error || response.statusCode);
        }
    });
}

function gpSubscribe(id, callback, force) {
    if (typeof callback === 'boolean') {
        force    = callback;
        callback = null;
    }

    if (subscribes.indexOf(id) !== -1)  {
        if (!force) {
            callback && callback(null);
            return;
        }
    } else {
        subscribes.push(id);
		updateSubscribeInfo();
    }

    if (!inited) {
        adapter.log.info('Subscribe is too early, will be sent after inited: ' + id);
        callback && callback();
        return;
    }

    if (id.substring(0, adapter.namespace.length) === adapter.namespace) {
        id = id.substring(adapter.namespace.length + 1);
    }

    var parts = id.split('.');
    var group = parts.shift();

    // TODO support of wildchars: graphpic.0.* (All), graphpic.0.A* (All groups starting with A), graphpic.0.groupName.* (all elements of groupName)

    adapter.log.debug('gpSubscribe: ' + id);
    adapter.log.info(adapter.config.connectionLink + '/api/subscribe/' + group + '/' + parts.join('.') + '/' + initString);

    request(adapter.config.connectionLink + '/api/subscribe/' + group + '/' + parts.join('.') + '/' + initString, function (error, response, body) {
        if (!error && response.statusCode === 200 && body === '"ok"') {
            callback && callback();
        } else {
            adapter.log.error('gpSubscribe: ' + (error || body));
            callback && callback(error || response.statusCode);
        }
    });
}

function gpUnsubscribe(id, callback) {
    var i = subscribes.indexOf(id);
    if (i === -1)  {
        callback && callback(null);
        return;
    }
    subscribes.splice(i, 1);
	updateSubscribeInfo();
	
    if (id.substring(0, adapter.namespace.length) === adapter.namespace) {
        id = id.substring(adapter.namespace.length + 1);
    }
    var parts = id.split('.');
    var group = parts.shift();

    adapter.log.info(adapter.config.connectionLink + '/api/unsubscribe/' + group + '/' + parts.join('.') + '/' + initString);

    request(adapter.config.connectionLink + '/api/unsubscribe/' + group + '/' + parts.join('.') + '/' + initString, function (error, response, body) {
        if (!error && response.statusCode === 200 && body === '"ok"') {
            callback && callback(error);
        } else {
            adapter.log.error('gpUnsubscribe: ' + error);
            callback && callback(error || response.statusCode);
        }
    });
}

function gpRequestVariables(group, callback) {
    request(adapter.config.connectionLink + '/api/groups/' + group, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var data = null;
            try {
                data = JSON.parse(body);
            } catch (error) {
                adapter.log.error('gpRequestGroups: cannot parse response - ' + error);
            }
            callback && callback(error, data, group);
        } else {
            adapter.log.error('gpRequestGroups: ' + error);
            callback && callback(error || response.statusCode, null, group);
        }
    });
}

function gpSendInit(callback) {
    adapter.log.info('Send init "' + 'http://' + adapter.config.bind + ':' + adapter.config.port + '/api/init/' + initString + '"');
    request(adapter.config.connectionLink + '/api/init/' + initString,
        function (error, response, body) {
            if (error) {
                adapter.log.error('Init response error - ' + error + ', body: ' + body);
            } else {
                adapter.log.info('Init response OK - ' + response.statusCode + ', body: ' + body);
            }
            if (!error && response && response.statusCode === 200){
				response.statusCode = null;			
				gpServerPort = Number(JSON.parse(body));
				adapter.log.info('GP Server Port set to ' + gpServerPort);
			} 
            if (callback) callback(error || (response ? response.statusCode : 'error'));
        });
}

// ------------------ Synchronise variables in ioBroker
function addToEnum(enumName, id, callback) {
    adapter.getForeignObject(enumName, function (err, obj) {
        if (!err && obj) {
            var pos = obj.common.members.indexOf(id);
            if (pos === -1) {
                obj.common.members.push(id);
                adapter.setForeignObject(obj._id, obj, function (err) {
                    if (callback) callback(err);
                });
            } else {
                if (callback) callback(err);
            }
        } else {
            if (callback) callback(err);
        }
    });
}

function removeFromEnum(enumName, id, callback) {
    adapter.getForeignObject(enumName, function (err, obj) {
        if (!err && obj) {
            var pos = obj.common.members.indexOf(id);
            if (pos !== -1) {
                obj.common.members.splice(pos, 1);
                adapter.setForeignObject(obj._id, obj, function (err) {
                    if (callback) callback(err);
                });
            } else {
                if (callback) callback(err);
            }
        } else {
            if (callback) callback(err);
        }
    });
}

function syncEnums(enumGroup, id, newEnumName, callback) {
    if (!enums[enumGroup]) {
        adapter.getEnum(enumGroup, function (err, _enums) {
            enums[enumGroup] = _enums;
            syncEnums(enumGroup, id, newEnumName, callback);
        });
        return;
    }
    // try to find this id in enums
    var found = false;
    for (var e in enums[enumGroup]) {
        if (enums[enumGroup][e].common &&
            enums[enumGroup][e].common.members &&
            enums[enumGroup][e].common.members.indexOf(id) !== -1) {
            if (enums[enumGroup][e]._id !== newEnumName) {
                removeFromEnum(enums[enumGroup][e]._id, id);
            } else {
                found = true;
            }
        }
    }
    if (!found && newEnumName) {
        addToEnum(newEnumName, id);
    }
}

function syncIoBrokerObjects() {
    for (var id in oldObjects) {
        delete oldObjects[id];
        id = id.substring(adapter.namespace.length + 1);
        // if object not exist in new configuration => delete it
        if (!objects[id]) {
            adapter.delObject(id, function (err, id) {
                adapter.delState(id, function (err, id) {
                    if (err) {
                        adapter.log.error('Cannot delete state[' + id + ']: ' + err);
                    }
                });
                if (err) {
                    adapter.log.error('Cannot delete object[' + id + ']: ' + err);
                }
                syncIoBrokerObjects();
            });
            return;
        }
    }
    oldObjects = null;
    adapter.subscribeStates('*');
}

// ---------------------- Web server --------------------
function startWebServer() {
    app.get('/update/:groupId/:varId/:quality/:value', function (req, res) {
        var id = req.params.groupId + '.' + req.params.varId;
        adapter.log.debug('update [' + id + ']: ' + req.params.value + 'Q: ' + req.params.quality);

        // accept info as ping
        checkPing();

        // If variable exists
        if (objects[id]) {
            var val = req.params.value;
			var quality = req.params.quality;
            if (val === '__bad__') {
                adapter.setState(id, { q: 0x84, ack: true });
            } else {
                if (objects[id].native.type === 'int') {
                    adapter.setState(id, { val: parseInt(val, 10), ack: true, q: parseInt(quality, 10)});
                } else if (objects[id].native.type === 'float') {
                    adapter.setState(id, { val: parseFloat(val), ack: true, q: parseInt(quality, 10)});
                } else if (objects[id].native.type === 'string') {
                    adapter.setState(id, { val: val.toString(), ack: true, q: parseInt(quality, 10)});
                } else if (objects[id].native.type === 'bool') {
                    if (val === 'true') val = true;
                    if (val === 'false') val = false;
                    adapter.setState(id, { val: val, ack: true, q: parseInt(quality, 10)});
                } else if (objects[id].native.type === 'block') {
                    // todo check json
                    adapter.setState(id, { val: val, ack: true, q: parseInt(quality, 10)});
                }
            }
        } else {
            if (inited) {
                adapter.log.warn('Unknown ID: ' + id);
                gpSendInit();
            }
        }

        res.send('OK');
    });

    app.get('/ping', function (req, res) {
        adapter.log.debug('ping');
        checkPing();
        res.send('OK');
    });

    server = app.listen(adapter.config.port, adapter.config.bind || undefined);
}

function checkPing(isStop) {
    // do not reset ping ofter than 1 seconds
    if (!isStop && pingLastCheck && new Date().getTime() - pingLastCheck < 1000) {
        return;
    }

    pingLastCheck = new Date().getTime();

    if (pingTimeout) {
        clearTimeout(pingTimeout);
    }
    if (isStop) {
        pingTimeout = null;
    } else {
        pingTimeout = setTimeout(function () {
            adapter.log.warn('No ping in ' + adapter.config.pingTimeout + 'ms. Reconnect...');
            // no ping in given time => mark as disconnected, try to sync
            adapter.setState('info.connection', false, true);
            inited = false;
            syncAll();
        }, adapter.config.pingTimeout);
    }
}

function syncGroup(groups, g, callback) {
    if (!groups || groups[g] === undefined) {
        return callback();
    }
    // create channel
    adapter.setObject(groups[g], {
        _id: groups[g],
        type: 'channel',
        common: {
            name: groups[g]
        },
        native: {

        }
    });

    // read all variables of one group
    gpRequestVariables(groups[g], function (err, items) {
        if (items) {
            adapter.log.info('Got ' + items.length + ' variables for group "' + groups[g] + '"');
            for (var i = 0; i < items.length; i++) {
                var id = groups[g] + '.' + items[i].name;

                objects[id] = {
                    _id: id,
                    common: {
                        name: items[i].name,
                        role: '',
                        type: '',
                        read: true,
                        write: true
                    },
                    type: 'state',
                    native: {
                        group: groups[g],
                        item: items[i].name,
                        type: items[i].type
                    }
                };
                if (items[i].type === 'int' || items[i].type === 'float') {
                    objects[id].common.type = 'number';
                    objects[id].common.def = 0;
                } else if (items[i].type === 'string') {
                    objects[id].common.type = 'string';
                    objects[id].common.def = '';
                } else if (items[i].type === 'bool') {
                    objects[id].common.type = 'boolean';
                    objects[id].common.def = false;
                } else if (items[i].type === 'block') {
                    objects[id].common.type = 'array';
                    objects[id].common.def = '[]';
                }
                adapter.log.debug('Got ' + id + ' of type "' + objects[id].common.type + '"');
            }
        } else {
            adapter.log.warn('No one variable in group"' + groups[g] + '"');
        }
        if (err) {
            callback(err);
        } else {
            syncGroup(groups, g + 1, callback);
        }
    });
}

function syncGroups(callback) {
    gpRequestGroups(function (err, groups) {
        if (err || !groups || !groups.length) {
            adapter.log.warn('Cannot connect to graphpic: ' + (err || 'no groups'));
            // if timeout => try one more time in rec
            return setTimeout(function () {
                syncGroups(callback);
            }, adapter.config.reconnectTimeout);
        } else {
            gpSendInit(function (err) {
                if (err) {
                    // if init error
                    return setTimeout(function () {
                        syncAll();
                    }, adapter.config.reconnectTimeout);
                } else {
                    syncGroup(groups, 0, function () {
                        for (var id in objects) {
                            adapter.setObject(id, objects[id]);
                        }

                        callback && callback(err);
                    });
                }
            });
        }
    });
}

function syncAll() {
    syncGroups(function (err) {
        if (!err) {
            adapter.setState('info.connection', true, true);

            if (oldObjects) syncIoBrokerObjects();

            // Subscribe all variables
            var vars = adapter.config.subList.split(/[\r\n|\r|\n\,]/);

            for (var v = 0; v < vars.length; v++) {
                if (!vars[v].trim()) continue;
                gpSubscribe(vars[v]);
            }

            if (!inited) {
                inited = new Date().getTime();
                // resubscribe all states
                setTimeout(function () {
                    resubscribeAll();
                }, 100);
            }
            // start ping monitoring
            checkPing();
        } else {
            // if init error
            return setTimeout(function () {
                syncAll();
            }, adapter.config.reconnectTimeout);
        }
    });
}

function startTcpServer(){
	var s = require('net').Server(function (socket) {


		socket.on('data', function (msg) {
			
			var message = msg.toString();
			console.log(message);
			
			var parts = message.split('/');
			var groupId = parts[0];
			var varId = parts[1];
			var value = parts[2];
			var quality = '__good__';
			var id = groupId + '.' + varId;
			adapter.log.debug('update [' + id + ']: ' + value + 'Q: ' + quality);
			// accept info as ping
			checkPing();

			// If variable exists
			if (objects[id]) {
				var val = value;
				if (val === '__bad__') {
					adapter.setState(id, { q: 0x84, ack: true });
				} else {
					if (objects[id].native.type === 'int') {
						adapter.setState(id, { val: parseInt(val, 10), ack: true, q: parseInt(quality, 10)});
					} else if (objects[id].native.type === 'float') {
						adapter.setState(id, { val: parseFloat(val), ack: true, q: parseInt(quality, 10)});
					} else if (objects[id].native.type === 'string') {
						adapter.setState(id, { val: val.toString(), ack: true, q: parseInt(quality, 10)});
					} else if (objects[id].native.type === 'bool') {
						if (val === 'true') val = true;
						if (val === 'false') val = false;
						adapter.setState(id, { val: val, ack: true, q: parseInt(quality, 10)});
					} else if (objects[id].native.type === 'block') {
						// todo check json
						adapter.setState(id, { val: val, ack: true, q: parseInt(quality, 10)});
					}
				}
			} else {
				if (inited) {
					adapter.log.warn('Unknown ID: ' + id);
					gpSendInit();
				}
			}
					
			socket.write('ok');
		});

		socket.on('end', function () {
			socket.end();	
		});

		socket.on('close', function () {
			socket.end();		
		});

		
		socket.on('error', function () {
			socket.end();		
		});
	});

	s.listen(adapter.config.tcpPort);
	adapter.log.warn('TCP Server listening to http://localhost:' + adapter.config.tcpPort);
}

function gpSetVar(id, state, callback) {

	if (!gpServerPort){
		adapter.log.error('gpServerPort is null');
	}

    if (!socket){
        var net = require('net');
        // var socket = new net.Socket();
        socket = net.createConnection(gpServerPort, gpServer, function(){
            adapter.log.debug('Connected to ' + gpServer + ':' + gpServerPort);
        });
        socket.setKeepAlive(true);
        socket.on('data', function(data) {
            adapter.log.debug('Received: ' + data);
            callback && callback();
        });
        socket.on('error', function (error) {
            adapter.log.error('error setting variable.' + error);
        });
        socket.on('close', function () {
            adapter.log.debug('Connection closed');
            socket = null;
        });
    }

    var message = objects[id].native.group + '/' + objects[id].native.item + '/' + state.val.toString() + '/_end_';
    adapter.log.debug('writing ' + message + ' to ' + gpServer + ':' + gpServerPort);
    socket.write(message);


    // var message = objects[id].native.group + '/' + objects[id].native.item + '/' + state.val.toString();
    //
	// var client = new require('net').Socket();
	// client.connect(gpServerPort, gpServer, function() {
	// 	adapter.log.debug('Connected to ' + gpServer + ':' + gpServerPort);
	// 	adapter.log.debug('writing ' + message + ' to ' + gpServer + ':' + gpServerPort);
	// 	client.write(message);
	// });
    //
	// client.on('data', function(data) {
	// 	adapter.log.debug('Received: ' + data);
	// 	callback && callback();
	// });
    //
	// client.on('error', function(error) {
	// 	adapter.log.error('error setting variable.' + error);
	// });
    //
	// client.on('close', function(hadError) {
	// 	adapter.log.debug('Connection closed');
	// });
}

function updateSubscribeInfo(){
	var first50 = subscribes.slice(0, 49);
	adapter.setState('info.subscribtions', first50.join('\r\n'), true);
}

function main() {
    adapter.config.reconnectTimeout = parseInt(adapter.config.reconnectTimeout, 10) || 30000;
    adapter.config.pingTimeout = parseInt(adapter.config.pingTimeout, 10) || 30000;
	adapter.config.port = parseInt(adapter.config.port, 10) || 8001;
	adapter.config.tcpPort = parseInt(adapter.config.tcpPort, 10) || 4001;
    gpServer = adapter.config.connectionLink.match(/https?:\/\/([-.\w\d]+)(:\d+)?/);
    gpServer = gpServer[1];

    initString = new Buffer('http://' + adapter.config.bind + ':' + adapter.config.port + '/' + '#' + adapter.config.bind + ':' + adapter.config.tcpPort).toString('base64');
	
    adapter.getStates('*', function (err, list) {
        oldObjects = list;
        // start Web server
        startWebServer();

		startTcpServer();
		
		updateSubscribeInfo();
		
        syncAll();
    });
}