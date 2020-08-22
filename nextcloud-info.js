module.exports = function(RED) {
	"use strict";
	var request = require("request");

	function requestInfoNC(node,msg,callback){
		node.status({fill:"blue",shape:"dot",text:"connecting.."});
		request.get(
		{
			url : node.url,
			headers : {
				"Authorization" : node.auth,
				"OCS-APIRequest": true
			},
			agentOptions: {
				rejectUnauthorized: !node.selfsignedcerts
			}
		},
		function (error, response, data) {
			if (error) {
				callback(error);
				return;
			}
			try {
			node.jsonNCDataResponse = JSON.parse(data);

			if(node.jsonNCDataResponse.ocs.meta.statuscode<>200 && node.jsonNCDataResponse.ocs.meta.statuscode<>100){
				callback(node.jsonNCDataResponse.ocs.meta.message);
				return;
			} else {
				// Request Successfull. Output data property
				node.jsonNCDataResponse = node.jsonNCDataResponse.ocs.data;
				callback();
			}
			} catch (e) {
				callback(e);
				return;
			}
		});
	}

	function NextcloudInfo(config) {
		RED.nodes.createNode(this,config);
		this.url = config.url;
		this.selfsignedcerts = config.selfsignedcerts;
		// set output-to name
		this.outproperty = config.outproperty||"payload";
		var node = this;
		// username and password fields use CREDENTIALS type
		var password = node.credentials.password;
		var username = node.credentials.username;
		node.on('input', function(msg) {
			if (msg.ncproperty) {
				this.outproperty = msg.ncproperty;
				delete msg.ncproperty;
			}
			if (msg.ncurl) {
				this.url = msg.ncurl;
				delete msg.ncurl;
			}
			// validate property: only one alphanumeric word with dashes and-or underscores
			if (!(/^[a-zA-Z0-9-_]+$/).test(node.outproperty)){
				// did not pass property validation then reset property name to payload
				node.outproperty="payload";
				node.error("Warning ncproperty: missing or incorrect parameter, payload will be used as output property",msg);
			}
			// validate url
			if (!(/^(http(s)?:\/\/)[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/).test(node.url)){
				// did not pass url validation then reset url var
				node.url="";
				node.error("Error ncurl: missing or incorrect parameter",msg);
			}
			if (node.credentials && node.credentials.hasOwnProperty("password") && node.credentials.hasOwnProperty("username") && node.url && node.outproperty){
				// use basic authentication
				node.auth = "Basic " + new Buffer(username + ":" + password).toString("base64");
				// force JSON format on SERVERINFO API
				if (node.url.indexOf("?format=json") == -1){
					node.url=node.url + "?format=json";
				}
				// async request with callback
				requestInfoNC(node,msg,function(err) {
						if (err) {
							node.status({fill:"red",shape:"dot",text:"connection error"});
							node.error(err,msg);
						} else {
							// Request Successfull. Output data property
							RED.util.setMessageProperty(msg,node.outproperty,node.jsonNCDataResponse);
							node.send(msg);
							// reset node status
							node.status({});
						}
				});
			} else {
				node.status({fill:"red",shape:"dot",text:"connection error"});
				node.error("Error mandatory fields: url, username, password, property",msg);
			}
		});
	}

	RED.nodes.registerType("nextcloud-info",NextcloudInfo,{
	 credentials: {
		username: {type:"password"},
		password: {type:"password"}
	 }
	});
}
