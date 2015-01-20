Parse-Entangle
===============

Real Time Databse synchronization, using Parse.

Currently super simple, more or less a proof of concept, inspired by Meteor DDP.

Does not have a few vital features, like security.

To use:

Start up the server in the server directory.

```sh
cd server
npm install
node server.js
```

Client side code is up in client/index.html, or you can visit http://ehzhang.me/parse-entangle/client/

You can see the real time in action by opening up two windodws side by side, and typing into each one!

Demo Video: https://www.dropbox.com/s/wzn2jumxlur6q9u/parse-entangle.mov?dl=0

How does it work?
-----------------

Parse-entangle creates **Entanglements**, which act as a form of local datastore on the client. Currently, it supports some fairly rudimentary insert, update, and destroy functions. It also uses another server in additon to Parse, which manages socket connections for that application.

These **Entanglements** *subscribe* to a certain type of Parse class. Currently, we simply subscribe to everything that the class has to offer.

When inserting, updating, or destroying an Object in the **Entanglement** using the *insert*, *update*, or *destroy* API, the client sends a request to Parse, which then takes the appropriate action on that object. Once the object has been successfully inserted, updated, or destroyed, a message is sent via WebSocket to a 'broadcasting' server.

This simple server, which exists to only transmit messages via sockets, takes the message and broadcasts it to all other clients that have an alive socket connection.

With this message now received, clients can patch their data accordingly.

### The Message

The message that allows for insert, update, and destroy is inspired by the DDP Protocol created by Meteor (https://www.meteor.com/ddp).

These messages have a few fields:
- msg: the action. this can be either 'added', 'changed', 'destroyed'
- collection: the collection of objects which this affects
- id: the id of the object in question
- fields: any fields that need to be saved, created, or updated

By sending incremental updates on changes in data, we can start with a set of data and keep our local database coordinated with Parse, without having to completely re-sync often. So long as the socket connection is alive, we can believe our data to be fresh.

#### On Latency Compensation (not implemented)

Because we also have a local datastore, we can compensate for the amount of time it takes to confirm an operation by Parse by reflecting that change on the client, making changes appear instant, assuming that database operations will more often than not succceed. In the case that an operation may fail, that object can then be patched again on the client in the error response.

Even if the socket connection drops, this would mean that a user could make operations on their local datastore, storing the changes. By polling for a connection, on success the user can then patch their data while also submitting any changes to Parse.