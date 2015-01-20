(function(){
  // Entanglement - A Real Time Synced Local DB made with Parse

  // CONSTANTS ------------------------------------------------
  var PARSE_APPLICATION_ID = 'FdRmoxybPkoW6BmpUnXFoN5gQvXK1h1VL58csG33';
  var PARSE_REST_API_KEY = 'xmcLKuAt0WF0g9KRGmpzk7itcCXbcn9DyuzQnpL8';

  // Routing Services
  var PARSE_API_VERSION = '1';
  var PARSE_API_ENDPOINT = 'https://api.parse.com/' + PARSE_API_VERSION + '/';

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
      if ((xmlhttp.readyState==4 || xmlhttp.readyState==2) && String(xmlhttp.status)[0] == 2){
        if (success){
          return success(JSON.parse(xmlhttp.responseText));
        };
      };
    };
  };

  // SockJS ---------------------------------------------------
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

  function handleData(data){
    if (data.msg == 'added') {
      console.log(data.collection + ' - New Object!')
      // Take the new data, and add it to our local store.
      var e = Parse.Entanglements[data.collection];
      e.db[data.id] = data.fields;
    }
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
    var endpoint = PARSE_API_ENDPOINT + path;
    this.get = function(id, callback){
      var r = new Request('GET', endpoint + (id ? id : ""), null, callback);
    };

    this.create = function(obj, callback){
      var r = new Request('POST', endpoint, obj, callback);
    };

    this.update = function(id, body, callback){
      var r = new Request('PUT', endpoint + (id ? id : ""), callback);
    };
  };

  var ClassService = function(className){
    this.className = className;
    return new Service('/classes/' + className);
  }

  // ----------------------------------------------------------

  // Keep track of all of the Entanglements
  Parse.Entanglements = {};

  // Entanglements act as local 'databases'
  var _e = Parse.Entanglement = function(className){
    // Name of the class collection
    this.className;
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
        this.db[results[i].objectId] = results[i]
      };
    }.bind(this))
  }

  // Insert an object into the collection
  _e.prototype.insert = function(obj, success, error) {
    // Save the object over on Parse
    this.service.create(obj, function(result){
      // YAY, SUCCESS, TELL EVERYONE!
      obj.createdAt = result.createdAt;
      obj.objectId = result.objectId;

      socket.send(JSON.stringify({
        msg: 'added',
        collection: this.className,
        id: result.objectId,
        fields: obj
      }));
    })
  };

  // Update an object in the collection
  _e.prototype.update = function(id, callback) {
    // Update the object currently in the db
  };

  _e.prototype.destroy = function(id, callback) {
    delete this.db[id];
  }

  _e.prototype.find = function(id, callback) {

  };

  _e.prototype.fetch = function(){
    var docs = [];
    for (key in this.db){
      docs.push(this.db[key]);
    }
    return docs;
  }

})()

var Messages = new Parse.Entanglement('Messages');

Messages.subscribe('all');