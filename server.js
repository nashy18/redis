//Initiallising Global variables and node modules
//To hold response object
var _response = {};
//To hold request object
var _request = {};
//To Store AuthToken
var _authToken = null; 
// require the dependencies we installed
var app = require('express')();
//https://github.com/NodeRedis/node_redis
var redis = require('redis');
var appConfig = require('./data/config.json');
var bodyParser = require("body-parser");
var mysql = require('mysql');
// set up the body-parser middleware
app.use(bodyParser.json());

//Initiallising my sql connection string -Starts 
 //http://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection
 var db_config = {
	host: appConfig.dbHost,
    user: appConfig.dbUserName,
    password: appConfig.dbPassword,
    database: appConfig.dbName
};

var connection;
function handleDisconnect() {
  connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

handleDisconnect();
//Initiallising my sql connection string -Ends

// create a new redis client and connect to our local redis instance
client = redis.createClient();
// create a new redis client and connect to cloud redis instance
//client = redis.createClient({url: '//pub-redis-17788.us-east-1-2.5.ec2.garantiadata.com:17788', password:'Power@1234'});

// if an error occurs, print it to the console
client.on('error', function (err) {
    console.log("Error " + err);
});

app.get('/api/redis/:table' , function(req, res) {
  var table = req.params.table;
   // use the redis client to get the total number of stars associated to that
  // table name from our redis cache
  client.get(table, function(error, result) {
      if (result) {
        // the result exists in our cache - return it to our user immediately
        res.send({ "Result": JSON.parse(result), "Source": "Redis Cache" });
		console.log('Querying Redis Cache : ' + table);
		//res.send(result);
      } else {
		  //Api call
		  //Getting Query to be executed
         var query = 'select * from ' + table ;
         console.log('Querying DB : ' + query);
         //Querying DB 
         connection.query(query, function (err, rows, fields) {
             if (err) {
                 console.log('Error');
                 _response.Success = false;
                 _response.Message = appConfig.recordReterived_Failed_Message;
                 _response.ErrorDetails = err;
             }
             else {
                 console.log('Success');
                 _response.Success = true;
                 _response.Message = appConfig.recordReterived_Success_Message;
                 _response.Records = rows;
				 // store the key-value pair (table:_response) in redis server cache
                 // with an expiry of 1 minute (60s)
				 client.setex(table, 60,  JSON.stringify(_response));
             }
			 //res.send(_response);
			  res.send({ "Result": _response, "Source": "Database" });
         });
      }
  });
});

//Setting appication port
app.set('port', (process.env.PORT || 5000));

//Running node server
app.listen(app.get('port'), function(){
  console.log('Server listening on port: ', app.get('port'));
});