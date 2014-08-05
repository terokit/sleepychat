var express = require('express');
var app = express();
var server = require('http').Server(app);
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var io = require('socket.io')(server);
require('array.prototype.find');

// This here is the admin password. For obvious reasons, set the ADMINPASS variable in production.
var secret = String(process.env.ADMINPASS || "testpassword");

server.listen(Number(process.env.PORT || 5000));

var index = require('./routes/index');
var stats = require('./routes/stats');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var users = [];

io.on('connection', function(socket)
{
	var nick = ""
	socket.on('login', function(data)
	{
		if(getUserByNick(nick))
		{
			socket.emit('information', "[INFO] The nickname you chose was in use. Please reload the page and choose another.");
		}
		else
		{
			data.socket = socket;
			nick = data.nick
			users.push(data);
			socket.emit('loggedIn');
			socket.emit('information', "[INFO] Hi there, " + nick + "! You're now connected to the server.");
		}

	});

	socket.on('getNewChat', function(data)
	{
		var user = getUserByNick(nick);
		try
		{
			users.remove(user);
			if(user.partner)
			{
				users.remove(user.partner);
				delete user.partner.partner;
				users.push(user.partner);
				user.partner.socket.emit('partnerDC', user.nick);
				delete user.partner;
			}
			var userscopy = users;
			for(var x = 0; x < userscopy.length; x++)
			{
				var potentialPartner = userscopy[x];
				var good = true;
				if(potentialPartner.partner || potentialPartner.nick === data.last)
				{
					good = false;
				}
				else
				{
					if(user.chatwith === "males" && potentialPartner.gender != "male")
					{
						good = false;
					}
					else if(user.chatwith === "females" && potentialPartner.gender != "female")
					{
						good = false;
					}
					else
					{
						if(user.type === "roleplaying" && potentialPartner.type === "hypnosis")
						{
							good = false;
						}
						else if(user.type === "hypnosis" && potentialPartner.type === "roleplaying")
						{
							good = false;
						}
						else
						{
							if(potentialPartner.chatwith === "males" && user.gender != "male")
							{
								good = false;
							}
							else if(potentialPartner.chatwith === "females" && user.gender != "female")
							{
								good = false;
							}
							else
							{
								if(potentialPartner.type === "roleplaying" && user.type === "hypnosis")
								{
									good = false;
								}
								else if(potentialPartner.type === "hypnosis" && user.type === "roleplaying")
								{
									good = false;
								}
								else
								{
									if(user.role === "tist" && potentialPartner.role === "tist")
									{
										good = false;
									}
									else if(user.role === "sub" && potentialPartner.role === "sub")
									{
										good = false;
									}
									else
									{
										good = true;
									}
								}
							}
						}
					}
				}
				if(good)
				{
					user.partner = potentialPartner;
					break;
				}
			}
			if(user.partner)
			{
				var found1 = "[INFO] Found a chat partner! Say hello to " + user.partner.nick + ", a ";
				var found2 = "[INFO] Found a chat partner! Say hello to " + user.nick + ", a ";

				if(user.partner.gender != "undisclosed")
					found1 += user.partner.gender;
				var nicerole1 = " switch.";
				if(user.partner.role === "tist")
					nicerole1 = " hypnotist.";
				else if(user.partner.role === "sub")
					nicerole1 = " subject.";
				found1 += " " + nicerole1;

				if(user.gender != "undisclosed")
					found2 += user.gender;
				var nicerole2 = " switch.";
				if(user.role === "tist")
					nicerole2 = " hypnotist.";
				else if(user.role === "sub")
					nicerole2 = " subject.";
				found2 += " " + nicerole2;

				socket.emit('information', found1);
				user.partner.socket.emit('information', found2);
				if(user.type === 'hypnosis' && user.partner.type === 'either')
				{
					user.partner.socket.emit('information', "[INFO] Please be aware that " + user.nick + " does not want to roleplay.");
				}
				if(user.type === 'roleplaying' && user.partner.type === 'either')
				{
					user.partner.socket.emit('information', "[INFO] Please be aware that " + user.nick + " is a roleplayer.");
				}
				if(user.partner.type === 'hypnosis' && user.type === 'either')
				{
					user.socket.emit('information', "[INFO] Please be aware that " + user.partner.nick + " does not want to roleplay.");
				}
				if(user.partner.type === 'roleplaying' && user.type === 'either')
				{
					user.socket.emit('information', "[INFO] Please be aware that " + user.partner.nick + " is a roleplayer.");
				}
				users.remove(user.partner);
				var usercopy = user;
				user.partner.partner = usercopy;
				users.push(user.partner);
				socket.emit('newChat', user.partner.nick);
				user.partner.socket.emit('newChat', user.nick);
			}
			else if(data.first == false)
			{
				socket.emit('information', "[INFO] Waiting for a new chat partner...");
			}
			else
			{
				socket.emit('information', "[INFO] Waiting for a suitable chat partner...");
			}
			users.push(user);
		}
		catch(e)
		{
			// This prevents us from crashing.
		}
	});

	socket.on('chat message', function(data)
	{
		if(data.message != "")
		{
			if(data.message.lastIndexOf('/server ' + secret, 0) === 0)
			{
				var command = '/server ' + secret + ' ';
				io.sockets.emit('information', "[ADMIN] " + data.message.substring(command.length));
			}
			else
			{
				var user = getUserByNick(nick);
				try
				{
					user.partner.socket.emit('chat message', '<' + nick + '> ' + data.message);
					socket.emit('chat message', '<' + nick + '> ' + data.message);
				}
				catch(e)
				{
					console.log('Bad message. ' + nick + ' ... ' + data.message);
				}
			}
		}
	});

	socket.on('disconnect', function()
	{
		var user = getUserByNick(nick);
		if(user)
		{
			if(user.partner)
			{
				users.remove(user.partner);
				delete user.partner.partner;
				users.push(user.partner);
				user.partner.socket.emit('partnerDC', user.nick);
			}
			users.remove(user);
		}
	});
});

function getUserByNick(nick)
{
	var userscopy = users;
	for(var x = 0; x < userscopy.length; x++)
	{
		if(userscopy[x].nick == nick)
		{
			return userscopy[x];
		}
	}
	return null;
}

setInterval(function()
{
	var usercopy = users;
	var males = 0;
	var females = 0;
	var undisclosed = 0;
	var tist = 0;
	var sub = 0;
	var switchrole = 0;
	for(var x = 0; x < usercopy.length; x++)
	{
		var workinguser = usercopy[x];

		if(workinguser.gender == 'male')
			males++;
		else if(workinguser.gender == 'female')
			females++;
		else
			undisclosed++;

		if(workinguser.role == 'tist')
			tist++;
		else if(workinguser.role == 'sub')
			sub++;
		else
			switchrole++;
	}
    io.sockets.emit('stats', { gender: { males: males, females: females, undisclosed: undisclosed }, role: { tist: tist, sub: sub, switchrole: switchrole } });
}, 1000);

app.use('/', index);
app.use('/' + secret, stats);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

module.exports = app;
