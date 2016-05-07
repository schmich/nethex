var barn = new Barn(localStorage);

function createHex() {
  var e = $('#template').clone();
  e.attr('id', null);
  return e;
}

function initialClass(row, col, size) {
  if ((row == 0 && col < size + 1) || (row > size && col > 0)) {
    return 'base two';
  }

  if (col == 0 || col > size) {
    return 'base one';
  }

  return null;
}

function Board(board, player, targetElem) {
  var self = this;

  var height = board.length;
  var width = board[0].length;

  var elements = [];

  this.player = player;
  this.turn = null;
  this.boardElem = targetElem;

  targetElem.addClass('board');
  if (player == 0) {
    targetElem.addClass('one');
  } else if (player == 1) {
    targetElem.addClass('two');
  }

  for (var r = 0; r < height + 2; ++r) {
    elements[r] = [];
    for (var c = 0; c < width + 2; ++c) {
      var e = createHex();
      elements[r][c] = e;
      e.addClass(initialClass(r, c, width /* TODO: Specify w/h */));
      if (r > 0 && r < (height + 1) && c > 0 && c < (width + 1)) {
        var claim = board[r - 1][c - 1];
        if (claim == 0) {
          e.addClass('one');
        } else if (claim == 1) {
          e.addClass('two');
        }
      }
      e.hover(function(t) {
        var h = $(t.target).closest('.hex:not(.base)');
        if (h.length === 0) {
          return;
        }
        var row = +h.data('r');
        var col = +h.data('c');
        self.onhover(row, col);
      });
      e.data('r', r - 1);
      e.data('c', c - 1);
      var ewidth = 34;
      var eheight = 40;
      var pad = 4;
      e.attr('x', c * (ewidth + pad) + r * ((ewidth + pad)/2));
      var ratio = 1 / Math.sqrt(3);
      e.attr('y', r * eheight - r * (ewidth/2 * ratio) + (r * (pad - 1)));
      targetElem.append(e);
    }
  }

  $(targetElem).click(function(e) {
    if (self.turn != self.player) {
      return;
    }

    var h = $(e.target).closest('.hex:not(.base)');
    if (h.length === 0) {
      return;
    }
    var row = +h.data('r');
    var col = +h.data('c');
    self.onclick(row, col);
  });

  this.onclick = function(row, col) { };
  this.onhover = function(row, col) { };

  this.mark = function(row, col, player) {
    var e = elements[row + 1][col + 1];
    if (e.hasClass('base')) {
      return;
    }

    if (player == 0) {
      e.removeClass('two');
      e.addClass('one');
    } else if (player == 1) {
      e.removeClass('one');
      e.addClass('two');
    } else if (player == 2) {
      e.removeClass('one two');
    }
  };

  this.lastGhostElem = null;
  this.setGhost = function(row, col) {
    var e = elements[row + 1][col + 1];
    if (e.hasClass('base')) {
      return;
    }

    if (this.lastGhostElem) {
      this.lastGhostElem.removeClass('ghost');
    }

    e.addClass('ghost');
    this.lastGhostElem = e;
  };

  this.setTurn = function(player) {
    this.turn = player;
    updateActive();
  };

  this.setPlayer = function(player) {
    if (player == 0) {
      targetElem.addClass('one');
    } else if (player == 1) {
      targetElem.addClass('two');
    }

    this.player = player;
    updateActive();
  };

  function updateActive() {
    if (self.turn == self.player) {
      self.boardElem.addClass('active');
    } else {
      self.boardElem.removeClass('active');
    }
  }
}

function loadTemplate(id, viewModel) {
  var template = document.getElementById(id);
  var clone = document.importNode(template.content, true);

  rivets.bind($(clone), { vm: viewModel });

  var body = document.body;
  while (body.firstChild) {
    body.removeChild(body.firstChild);
  }

  body.appendChild(clone);
}

var $router = Router({
  '/': showIndex,
  '/:slug': showGame
});

$router.configure({ html5history: true });

rivets.formatters.null = function(value) {
  return value === null;
};

function post(url, data, success) {
  return $.ajax({
    url: url,
    type: 'POST',
    data: JSON.stringify(data),
    dataType: 'json',
    contentType: 'application/json',
    success: success
  });
}

function showIndex() {
  var vm = {
    startGame: function() {
      var slug = $('#slug').val();

      var params = {
        size: 15,
        slug: slug
      };

      post('/api/games', params, function(res) {
        $router.setRoute('/' + slug);
      });

      return false;
    }
  };

  loadTemplate('index', vm);

  $.get('/api/slug', function(res) {
    $('#slug').typed({ strings: [res.slug] });
  });

  $('#slug').focus();
}

function showGame(slug) {
  var socket = io();

  var vm = {
    player: null,
    playerAvailable: [false, false],
    joinGame: function(e) {
      var player = e.target.dataset.player;
      socket.emit('game:join', { slug: slug, player: player });
      return false;
    }
  };

  loadTemplate('game', vm);

  socket.emit('game:load', {
    slug: slug,
    token: barn.get(slug)
  });

  socket.on('hex:error', function(e) {
    console.log(e);
  });

  socket.on('game:loaded', function(game) {
    vm.player = game.player;
    vm.playersAvailable = game.playersAvailable;

    var elem = $('#board');
    var board = new Board(game.board, game.player, elem);
    board.onclick = function(row, col) {
      socket.emit('game:move', { slug: slug, token: barn.get(slug), row: row, col: col });
    };

    board.onhover = function(row, col) {
      socket.emit('game:ghost', { slug: slug, row: row, col: col });
    };

    board.setTurn(game.turn);

    socket.on('game:moved', function(e) {
      board.mark(e.row, e.col, e.player);
      board.setTurn(e.turn);
      console.log(e.winner);
    });

    socket.on('game:joined', function(res) {
      vm.player = res.player;
      barn.set(slug, res.token);
      board.setPlayer(res.player);
    });

    socket.on('game:ghost', function(res) {
      board.setGhost(res.row, res.col);
    });
  });

  socket.on('player:joined', function(res) {
    vm.playersAvailable[res.player] = false;
  });
}

$(function() { $router.init(); });
