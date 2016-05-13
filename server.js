var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
var adjNoun = require('adj-noun');
var crypto = require('crypto');
var MongoClient = require('mongodb').MongoClient;

var games = null;

adjNoun.seed(+(new Date()));

function createToken() {
  return crypto.randomBytes(16).toString('hex');
}

function error(socket, message) {
  socket.emit('hex:error', { error: message });
}

io.on('connection', function(socket) {
  console.log('Connect.');

  socket.on('game:move', function(e) {
    var slug = e.slug;
    var token = e.token;

    var row = parseInt(e.row);
    var col = parseInt(e.col);

    if (isNaN(row) || isNaN(col)) {
      return;
    }

    games.findOne({ slug: slug, active: true }, function(err, game) {
      if (err || !game) { /* ... */ }

      var board = game.board;
      if (row >= board.length || col >= board.length) {
        return error(socket, 'Move is out of bounds.');
      }

      if (board[row][col] !== 2) {
        return error(socket, 'Move is invalid.');
      }

      var invalidToken =
        (token === null) ||
        (game.players[game.turn] === null) ||
        (game.players[game.turn].token === null) ||
        (game.players[game.turn].token !== token);

      if (invalidToken) {
        return error(socket, 'Invalid player token.');
      }

      var turn = game.turn;
      board[row][col] = turn;

      var newTurn = 1 - turn;

      var update = {
        $set: {
          board: board,
          turn: newTurn
        }
      };

      var winner = findWinner(board);
      games.update({ _id: game._id }, update, function(err) {
        io.in(slug).emit('game:moved', { row: row, col: col, player: turn, turn: newTurn, winner: winner });
      });
    });
  });

  socket.on('game:load', function(e) {
    var slug = e.slug;
    var token = e.token;
    getGame(slug, token, function(err, game) {
      var winner = findWinner(game.board);
      game.winner = winner;
      socket.emit('game:loaded', game);
    });

    socket.join(slug);
  });

  socket.on('game:join', function(e) {
    var slug = e.slug;
    var player = parseInt(e.player);

    joinGame(slug, player, socket.id, function(err, res) {
      if (err) {
        socket.emit('hex:error', err);
      } else {
        socket.emit('game:joined', res);
        io.in(slug).emit('player:joined', { player: player });
      }
    });
  });

  socket.on('game:ghost', function(e) {
    socket.broadcast.to(e.slug).emit('game:ghost', { row: e.row, col: e.col });
  });

  socket.on('disconnect', function() {
    console.log('Disconnect.');
  });
});

app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/api/games', function(req, res) {
  var slug = (req.body.slug || '').toString().trim();
  if (slug.length == 0 || slug.length > 32) {
    return res.status(400).json({ error: 'Invalid slug.' });
  }

  // TODO: Validate slug: all lower case letters or dashes
  // TODO: Ensure active game with same slug doesn't already exist.

  var size = parseInt(req.body.size);
  if (!size || size < 0 || size > 20) {
    return res.status(400).json({ error: 'Invalid size.'});
  }

  var board = [];
  for (var row = 0; row < size; ++row) {
    board[row] = [];
    for (var col = 0; col < size; ++col) {
      board[row][col] = 2;
    }
  }

  var game = {
    slug: slug,
    board: board,
    turn: 0,
    active: true,
    players: [null, null],
    created: new Date()
  };

  games.insert(game, function(err) {
    res.json({ sucess: true, slug: slug });
  });
});

function getGame(slug, token, next) {
  games.findOne({ slug: slug, active: true }, function(err, game) {
    if (err || !game) {
      return next('Game not found.', null);
    }

    var player = null;
    if (token !== null) {
      var players = game.players;
      if (players[0] !== null && players[0].token === token) {
        player = 0;
      } else if (players[1] !== null && players[1].token === token) {
        player = 1;
      }
    }

    var playersAvailable = [
      game.players[0] === null,
      game.players[1] === null
    ];

    return next(null, { board: game.board, turn: game.turn, playersAvailable: playersAvailable, player: player });
  });
}

function createMarks(board) {
  var marks = [];
  for (var row = 0; row < board.length; ++row) {
    marks[row] = [];
    for (var col = 0; col < board[row].length; ++col) {
      marks[row][col] = false;
    }
  }

  return marks;
}

function doFindWinner(board, queue, marks, player, winFn) {
  function tryQueue(row, col) {
    if ((board[row][col] === player) && !marks[row][col]) {
      queue.push([row, col]);
    }
  }

  while (queue.length > 0) {
    var coords = queue.shift();
    var row = coords[0];
    var col = coords[1];

    if (winFn(row, col)) {
      return true;
    }

    marks[row][col] = true;

    var canUp = (row > 0);
    var canLeft = (col > 0);
    var canRight = (col < (board[0].length - 1));
    var canDown = (row < (board.length - 1));

    if (canUp) {
      tryQueue(row - 1, col);

      if (canRight) {
        tryQueue(row - 1, col + 1);
      }
    }

    if (canDown) {
      tryQueue(row + 1, col);

      if (canLeft) {
        tryQueue(row + 1, col - 1);
      }
    }

    if (canLeft) {
      tryQueue(row, col - 1);
    }

    if (canRight) {
      tryQueue(row, col + 1);
    }
  }

  return false;
}

function findVerticalWinner(board) {
  var marks = createMarks(board);

  var queue = [];
  for (var col = 0; col < board[0].length; ++col) {
    queue.push([0, col]);
    marks[0][col] = true;
  }

  return doFindWinner(board, queue, marks, 1, function(row, col) {
    return row === board.length - 1;
  });
}

function findHorizontalWinner(board) {
  var marks = createMarks(board);

  var queue = [];
  for (var row = 0; row < board.length; ++row) {
    queue.push([row, 0]);
    marks[row][0] = true;
  }

  return doFindWinner(board, queue, marks, 0, function(row, col) {
    return col === board[0].length - 1;
  });
}

function findWinner(board) {
  if (findHorizontalWinner(board)) {
    return 0;
  }

  if (findVerticalWinner(board)) {
    return 1;
  }

  return null;
}

function joinGame(slug, player, socketId, next) {
  if (player < 0 || player > 1) {
    return next('Invalid player number.', null);
  }

  games.findOne({ slug: slug, active: true }, function(err, game) {
    if (err || !game) {
      return next('Game not found.', null);
    }

    var players = game.players;
    if (players[player] !== null) {
      return next('Seat is not available.', null);
    }

    var otherPlayer = players[1 - player];
    if (otherPlayer !== null && otherPlayer.socketId == socketId) {
      return next('You cannot join the game twice.', null);
    }

    var token = createToken();
    players[player] = {
      token: token,
      socketId: socketId
    };

    games.update({ _id: game._id }, { $set: { players: players }}, function(err) {
      return next(null, { player: player, token: token });
    });
  });
}

function createSlug() {
  var slug;
  do
  {
    slug = adjNoun().join('-');
  } while (slug.length > 20)

  return slug;
}

app.get('/api/slug', function(req, res) {
  // TODO: Check for active game slug usage.
  res.json({ slug: createSlug() });
});

app.get('*', function(req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

MongoClient.connect('mongodb://localhost:27017/nethex', function(err, db) {
  games = db.collection('games');

  http.listen(3000, '0.0.0.0', function() {
    console.log('Listening on 3000.');
  });
});
