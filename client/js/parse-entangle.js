(function(){
  // Entanglement - A Real Time Synced Local DB made with Parse

  // CONSTANTS ------------------------------------------------
  var PARSE_APPLICATION_ID = 'FdRmoxybPkoW6BmpUnXFoN5gQvXK1h1VL58csG33';
  var PARSE_REST_API_KEY = 'xmcLKuAt0WF0g9KRGmpzk7itcCXbcn9DyuzQnpL8';

  // Routing Services
  var PARSE_API_VERSION = '1';
  var PARSE_API_ENDPOINT = 'https://api.parse.com/' + PARSE_API_VERSION;

  // Socket Server
  var SOCKET_SERVER = 'http://localhost:3000/entangle';

  // API Requests ---------------------------------------------

  var Request = function(type, url, body, success){
    var xmlhttp = new XMLHttpRequest();

    xmlhttp.open(type, url, true);
    xmlhttp.setRequestHeader("X-Parse-Application-Id", PARSE_APPLICATION_ID);
    xmlhttp.setRequestHeader("X-Parse-REST-API-Key", PARSE_REST_API_KEY);
    xmlhttp.setRequestHeader("Content-type","application/json");

    xmlhttp.send(JSON.stringify(body));

    xmlhttp.onreadystatechange = function (){
      // Success
      if ((xmlhttp.readyState == 4 || xmlhttp.readyState == 2) && String(xmlhttp.status)[0] == 2){
        if (success && xmlhttp.responseText){
          success(JSON.parse(xmlhttp.responseText));
        };
      };
    };
  };

  // SockJS ---------------------------------------------------
  var socket;
  function attemptConnection(){

    socket = new SockJS(SOCKET_SERVER);

    socket.onopen = function() {
      console.log('Connection Open');
    };

    socket.onmessage = function(e) {
      handleData(JSON.parse(e.data));
    };

    socket.onclose = function() {
      console.log('Connection Closed');
    };
  }

  try {
    attemptConnection();
  } catch(e) {
    console.log("Could not establish connection.");
  }


  function handleData(data){
    var e = Parse.Entanglements[data.collection];

    if (data.msg == 'added') {
      console.log(data.collection + ' - New Object: ' + data.id)
      // Take the new data, and add it to our local store.
      e.db[data.id] = new EObj(data.fields);
    }
    if (data.msg == 'changed') {
      console.log(data.collection + ' - Object Changed: ' + data.id)
      // Update the keys in the db
      if (e.db[data.id]){
        for (key in data.fields){
          e.db[data.id][key] = data.fields[key];
        }
        e.db[data.id]._resetChanges();
      }
    }

    if (data.msg == 'removed') {
      console.log(data.collection + ' - Object Removed: ' + data.id)
      delete e.db[data.id];
    }

    // Fire an onChange listener if there is one
    if (e.onChange){ e.onChange() }
  };

  // DDP Protocol ---------------------------------------------
  // Examples:

  // ADDED:
  // {"msg": "added", "collection": "transactions", "id": "record-1", "fields": {"amount": "50USD", "from": "tom"}}

  // CHANGED:
  // {"msg": "changed", collection": "transactions", "id": "doc_id", "fields": {"amount": "300USD"}}

  // REMOVED:
  // {"msg": "removed", "collection": "transactions", "id": "doc_id"}


  // Services to wrap API Calls -------------------------------
  var Service = function(path){
    this.endpoint = PARSE_API_ENDPOINT + path;
  }

  Service.prototype.get = function(id, callback){
    return new Request('GET', this.endpoint + (id ? id : ""), null, callback);
  };

  Service.prototype.create = function(obj, callback){
    return new Request('POST', this.endpoint, obj, callback);
  };

  Service.prototype.update = function(id, body, callback){
    return new Request('PUT', this.endpoint + (id ? id : ""), body, callback);
  };

  Service.prototype.delete = function(id, callback){
    return new Request('DELETE', this.endpoint + (id ? id : ""), null, callback);
  };

  var ClassService = function(className){
    return new Service('/classes/' + className + '/');
  }

  // ----------------------------------------------------------

  // Keep track of all of the Entanglements
  Parse.Entanglements = {};

  // Extend an object with getters and setters
  var EObj = function(obj){
    // Extend the object
    for (key in obj){
      this[key] = obj[key];
    }

    // Keep track of changes to the object
    this._changes = {}
  }

  EObj.prototype.set = function(prop, value){
    this[prop] = value;
    this._changes[prop] = value;
  }

  EObj.prototype._resetChanges = function(){
    this._changes = {};
  }

  // Entanglements act as local 'databases'
  var _e = Parse.Entanglement = function(className){
    // Name of the class collection
    this.className = className;
    // Key value store for all objects
    this.db = {};
    // Create a service for this object
    this.service = ClassService(className);
    // Store this in the global Entanglements store
    Parse.Entanglements[className] = this;
  }

  _e.prototype.subscribe = function(subscription){
    // Subscribe to all for now
    this.service.get(null, function(response){
      var results = response.results;
      for (var i = results.length - 1; i >= 0; i--) {
        this.db[results[i].objectId] = new EObj(results[i]);
      };

      if (this.onChange){
        this.onChange();
      }
    }.bind(this))


  }

  // Insert an object into the collection
  _e.prototype.insert = function(obj, success, error) {
    var e = this;
    // Save the object over on Parse
    this.service.create(obj, function(result){
      // YAY, SUCCESS, TELL EVERYONE!
      obj.createdAt = result.createdAt;
      obj.objectId = result.objectId;

      socket.send(JSON.stringify({
        msg: 'added',
        collection: e.className,
        id: result.objectId,
        fields: obj
      }));

      success();
    })
  };

  // Update an object in the collection
  _e.prototype.update = function(id, success) {
    // Update the object currently in the db
    var e = this;
    this.service.update(id, this.db[id]._changes, function(result){
      // Successfully updated! Tell the world!
      socket.send(JSON.stringify({
        msg: 'changed',
        collection: e.className,
        id: id,
        fields: e.db[id]._changes
      }));
      success();
    })
  };

  _e.prototype.destroy = function(id, success) {
    // Remove the stuff
    var e = this;
    this.service.delete(id, function(result){
      if (!result.error){
        // Object deleted, tell the world!
        socket.send(JSON.stringify({
          msg: 'removed',
          collection: e.className,
          id: id,
        }));
        success();
      }
    })
  }

  _e.prototype.fetch = function(){
    var docs = [];
    for (key in this.db){
      docs.push(this.db[key]);
    }
    return docs;
  }

})()
