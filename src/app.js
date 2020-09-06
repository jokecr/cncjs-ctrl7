$(function () {
  var root = window;
  var cnc = root.cnc || {};
  var controller = cnc.controller;
  var pending = 0;
  var busy = false;
  var prb = {};
  var bitSetterInit = {};
  var msgStack = ['Init'];
  var step = 1.00;
  var tlo = 0;

  function show(str) {
    var msg = '';
    msgStack.push(str);
    msgStack.splice(0, msgStack.length - 20);
    msg = msgStack.join(', ').split('G90, ');
    msg.splice(0, msg.length - 4);
    msg.join('<br>G90 ');
    $('[data-route="axes"] [data-name="gcode"]').html(msg);
  }
  controller.commandQueue = async.queue(function (task, commandDone) {
    console.log(task);
    busy = true;
    console.log(`Start:${task.mode}:${task.data}`);
    if (task.mode == 'notify') {
      show(task.data);
      commandDone();
    }
    if (task.mode == 'gcode') {
      controller.command('gcode', task.data);
      pending = 1;
      async.whilst(
        function test(cb) {
          cb(null, pending > 0);
        },
        function iter(wait) {
          setTimeout(function () {
            wait(null, 'waiting');
          }, 125);
        },
        function (err, n) {
          console.log(`Done:${task.data}`);
          commandDone();
        }
      );
    }
  }, 1);
  controller.commandQueue.drain(function () {
    console.log('all items have been processed');
    busy = false;
  });
  controller.on('serialport:list', function (list) {
    var $el = $('[data-route="connection"] select[data-name="port"]');
    $el.empty();
    $.each(list, function (key, value) {
      var $option = $('<option></option>')
        .attr('value', value.port)
        .attr('data-inuse', value.inuse)
        .text(value.port);
      $el.append($option);
    });
    if (cnc.controllerType) {
      $('[data-route="connection"] select[data-name="controllerType"]').val(cnc.controllerType);
    }
    if (cnc.port) {
      $('[data-route="connection"] select[data-name="port"]').val(cnc.port);
    }
    if (cnc.baudrate) {
      $('[data-route="connection"] select[data-name="baudrate"]').val(cnc.baudrate);
    }
  });
  controller.on('serialport:open', function (options) {
    var controllerType = options.controllerType;
    var port = options.port;
    var baudrate = options.baudrate;
    console.log('Connected to \'' + port + '\' at ' + baudrate + '.');
    cnc.connected = true;
    cnc.controllerType = controllerType;
    cnc.port = port;
    cnc.baudrate = baudrate;
    $('[data-route="workspace"] [data-name="port"]').val(port);
    Cookies.set('cnc.controllerType', controllerType);
    Cookies.set('cnc.port', port);
    Cookies.set('cnc.baudrate', baudrate);
    if (controllerType === 'Grbl') {
      // Read the settings so we can determine the units for position reports
      // This will trigger a Grbl:settings callback to set grblReportingUnits
      // This has a problem: The first status report arrives before the
      // settings report, so interpreting the numbers from the first status
      // report is ambiguous.  Subsequent status reports are interpreted correctly.
      // We work around that by deferring status reports until the settings report.
      controller.writeln('$$');
    }
    root.location = '#/axes';
    controller.writeln('$#');
  });
  controller.on('serialport:close', function (options) {
    var port = options.port;
    console.log('Disconnected from \'' + port + '\'.');
    cnc.connected = false;
    cnc.controllerType = '';
    cnc.port = '';
    cnc.baudrate = 0;
    $('[data-route="workspace"] [data-name="port"]').val('');
    $('[data-route="axes"] [data-name="active-state"]').text('Not connected');
    root.location = '#/connection';
  });
  controller.on('serialport:error', function (options) {
    var port = options.port;
    console.log('Error opening serial port \'' + port + '\'');
    $('[data-route="connection"] [data-name="msg"]').html('<p style="color: red">Error opening serial port \'' + port + '\'</p>');
  });
  cnc.bitSetter = function (mode) {
    console.log('cnc.bitSetter');
    if (mode == 'Init') {
      console.log('Init');
      var modalWas = _.clone(controller.state.modal);
      // G53: Temporary move in Absolute Coordinates
      // G4: Dwell
      // G0, G1: Linear Motions (Rapid, linear at feedrate)
      // G90, G91: Distance Modes (absolute,relative)
      // G38.2: Probing toward
      // G38.4: Probing away
      // M6: Tool change
      pending = 0;
      controller.commandQueue.push({
        mode: 'notify',
        data: `Move to safe height`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G53 G0 z-5'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Move to bit setter`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G53 G0 x-5 y-819'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G91'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe toward<br>80mm@200mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.2 Z-80 F1200'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe away<br>10mm@20mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.4 z10 F80'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe toward<br>10mm@10mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.2 z-10 F20'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe away<br>10mm@5mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.4 z10 F5'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      // Back to absolute
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G90'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Move to safe height`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G53 G0 z-5'
      }, () => {
        bitSetterInit = _.clone(prb);
        // Tool length offset
        controller.commandQueue.push({
          mode: 'gcode',
          data: `G43.1 Z0`
        })
        $('[data-route="axes"] [data-name="stickout"]').html(`Stickout:${-68.575 - prb.z}<br>TLO:0`);
        controller.commandQueue.push({
          mode: 'notify',
          data: `<b>TLO Zeroed to Current Bit</b>`
        });
      });
      // Empty collet = Z-68.575
      // TODO: Determine the settled Z height here
    }
    if (mode == 'ToolChange') {
      console.log('ToolChange');
      pending = 0;
      controller.commandQueue.push({
        mode: 'notify',
        data: `Move to safe height`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G53 G0 z-5'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Move to tool change`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G53 G0 x-5 y-780'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      }, () => {
        controller.commandQueue.push({
          mode: 'notify',
          data: `<b>Change Tool and hit TCI</b>`
        });
      });
    }
    if (mode == 'ToolChangeInit') {
      controller.commandQueue.push({
        mode: 'notify',
        data: `Move to Bit Setter`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G53 G0 z-5'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G53 G0 x-5 y-819'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      // Switch to relative
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G91'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe toward<br>80mm@200mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.2 Z-80 F1200'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe away<br>10mm@20mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.4 z10 F80'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe toward<br>10mm@10mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.2 z-10 F20'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.25'
      });
      controller.commandQueue.push({
        mode: 'notify',
        data: `Probe away<br>10mm@5mm/m`
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G38.4 z10 F5'
      });
      // Back to absolute
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G90'
      });
      controller.commandQueue.push({
        mode: 'gcode',
        data: 'G4 P.5'
      }, () => {
        $('[data-route="axes"] [data-name="stickout"]').html(`Stickout:${-68.575 - prb.z}<br>TLO:${bitSetterInit.z-prb.z}`);
        controller.commandQueue.push({
          mode: 'notify',
          data: `Set current Z ${controller.state.status.mpos.z}<br>
          to ${bitSetterInit.z}`
        });
        // Tool length offset
        controller.commandQueue.push({
          mode: 'gcode',
          data: `G43.1 Z${prb.z-bitSetterInit.z}`
        })
        controller.commandQueue.push({
          mode: 'gcode',
          data: 'G4 P.5'
        }, () => {
          controller.commandQueue.push({
            mode: 'gcode',
            data: 'G53 G0 z-5'
          });
        });
      });
    }
  };
  cnc.setStep = function (newStep) {
    step = newStep;
    console.log(`Step:${step}`)
    $('[data-route="axes"] [data-name="step"]').text(step);
  }
  cnc.sendMove = function (cmd) {
    var jog = function (params) {
      params = params || {};
      var s = _.map(params, function (value, letter) {
        return '' + letter + value;
      }).join(' ');
      controller.command('gcode', 'G91 G0 ' + s); // relative distance
      controller.command('gcode', 'G90'); // absolute distance
    };
    var move = function (params) {
      params = params || {};
      var s = _.map(params, function (value, letter) {
        return '' + letter + value;
      }).join(' ');
      controller.command('gcode', 'G0 ' + s);
    };
    // var distance = Number($('[data-route="axes"] select[data-name="select-distance"]').val()) || 0;
    var fn = {
      'G28': function () {
        controller.command('gcode', 'G28');
      },
      'G30': function () {
        controller.command('gcode', 'G30');
      },
      'X0Y0Z0': function () {
        move({
          X: 0,
          Y: 0,
          Z: 0
        })
      },
      'X0': function () {
        move({
          X: 0
        });
      },
      'Y0': function () {
        move({
          Y: 0
        });
      },
      'Z0': function () {
        move({
          Z: 0
        });
      },
      'X-Y+': function () {
        jog({
          X: -step,
          Y: step
        });
      },
      'X+Y+': function () {
        jog({
          X: step,
          Y: step
        });
      },
      'X-Y-': function () {
        jog({
          X: -step,
          Y: -step
        });
      },
      'X+Y-': function () {
        jog({
          X: step,
          Y: -step
        });
      },
      'X-': function () {
        jog({
          X: -step
        });
      },
      'X+': function () {
        jog({
          X: step
        });
      },
      'Y-': function () {
        jog({
          Y: -step
        });
      },
      'Y+': function () {
        jog({
          Y: step
        });
      },
      'Z-': function () {
        jog({
          Z: -step
        });
      },
      'Z+': function () {
        jog({
          Z: step
        });
      }
    } [cmd];
    fn && fn();
  };
  controller.on('serialport:read', function (data) {
    var style = 'font-weight: bold; line-height: 20px; padding: 2px 4px; border: 1px solid; color: #222; background: #F5F5F5';
    if (data == 'ok') {
      pending -= 1;
    }
    console.log('%i) %cR%c', pending, style, '', data);
    if (data == 'ok') {
      return;
    }
    show(data);
    // var str = $('[data-route="axes"] [data-name="gcode"]').html();
    // var a = str.split('<br>');
    // a.push(data);
    // var htmlStr = _.takeRight(a, 3).join('<br>');
    if (/^\[PRB:/.test(data)) {
      // htmlStr = data;
      var p = /^\[PRB:([0-9\-.]+),([0-9\-.]+),([0-9\-.]+):([01])\]/i
      var result = p.exec(data);
      if (result !== null) {
        prb = {
          x: result[1],
          y: result[2],
          z: result[3],
          success: result[4]
        }
        console.log(prb);
      }
    }
    if (/^\[TLO:/.test(data)) {
      // htmlStr = data;
      var p = /^\[TLO:([0-9\-.]+)\]/i
      var result = p.exec(data);
      if (result !== null) {
        tlo = result[1];
      }
    }
    // $('[data-route="axes"] [data-name="gcode"]').html(htmlStr);
    $('[data-route="axes"] [data-name="stickout"]').html(`Stickout:${-68.575 - prb.z}<br>TLO:${tlo}`);
  });
  // GRBL reports position in units according to the $13 setting,
  // independent of the GCode in/mm parser state.
  // We track the $13 value by watching for the Grbl:settings event and by
  // watching for manual changes via serialport:write.  Upon initial connection,
  // we issue a settings request in serialport:open.
  var grblReportingUnits; // initially undefined
  controller.on('serialport:write', function (data) {
    var style = 'font-weight: bold; line-height: 20px; padding: 2px 4px; border: 1px solid; color: #00529B; background: #BDE5F8';
    if (cnc.controllerType === 'Grbl') {
      cmd = data.split('=');
      if (cmd.length === 2 && cmd[0] === "$13") {
        grblReportingUnits = Number(cmd[1]) || 0;
      }
    }
    if (data != '') {
      // pending += 1;
    }
    console.log('%i) %cW%c', pending, style, '', data);
    show(data);
    // var str = $('[data-route="axes"] [data-name="gcode"]').html();
    // var a = str.split('<br>');
    // a.push(data);
    // var str = $('[data-route="axes"] [data-name="gcode"]').html(_.takeRight(a, 3).join('<br>'));
    // Track manual changes to the Grbl position reporting units setting
    // We are looking for either $13=0 or $13=1
  });
  // This is a copy of the Grbl:state report that came in before the Grbl:settings report
  var savedGrblState;

  function renderGrblState(data) {
    var status = data.status || {};
    var activeState = status.activeState;
    var mpos = status.mpos;
    var wpos = status.wpos;
    var IDLE = 'Idle',
      RUN = 'Run';
    var canClick = [IDLE, RUN].indexOf(activeState) >= 0;
    var parserstate = data.parserstate || {};
    // Unit conversion factor - depends on both $13 setting and parser units
    var factor = 1.0;
    // Number of postdecimal digits to display; 3 for in, 4 for mm
    var digits = 4;
    var mlabel = 'MPos:';
    var wlabel = 'WPos:';
    switch (parserstate.modal.units) {
    case 'G20':
      mlabel = 'MPos (in):';
      wlabel = 'WPos (in):';
      digits = 4;
      factor = grblReportingUnits === 0 ? 1 / 25.4 : 1.0;
      break;
    case 'G21':
      mlabel = 'MPos (mm):';
      wlabel = 'WPos (mm):';
      digits = 3;
      factor = grblReportingUnits === 0 ? 1.0 : 25.4;
      break;
    }
    //console.log(grblReportingUnits, factor);
    mpos.x = (mpos.x * factor).toFixed(digits);
    mpos.y = (mpos.y * factor).toFixed(digits);
    mpos.z = (mpos.z * factor).toFixed(digits);
    wpos.x = (wpos.x * factor).toFixed(digits);
    wpos.y = (wpos.y * factor).toFixed(digits);
    wpos.z = (wpos.z * factor).toFixed(digits);
    if (!canClick) {
      console.log('DISABLE BUTTONS');
    } else {
      console.log('enable BUTTONS');
    }
    if (!canClick) {
      $('[data-route="axes"] .control-pad').addClass('disabled');
    } else {
      $('[data-route="axes"] .control-pad').removeClass('disabled');
    }
    $('[data-route="axes"] .control-pad .btn').prop('disabled', !canClick);
    $('[data-route="axes"] [data-name="active-state"]').text(activeState);
    $('[data-route="axes"] [data-name="mpos-label"]').text(mlabel);
    $('[data-route="axes"] [data-name="mpos-x"]').text(mpos.x);
    $('[data-route="axes"] [data-name="mpos-y"]').text(mpos.y);
    $('[data-route="axes"] [data-name="mpos-z"]').text(mpos.z);
    $('[data-route="axes"] [data-name="wpos-label"]').text(wlabel);
    $('[data-route="axes"] [data-name="wpos-x"]').text(wpos.x);
    $('[data-route="axes"] [data-name="wpos-y"]').text(wpos.y);
    $('[data-route="axes"] [data-name="wpos-z"]').text(wpos.z);
  }
  controller.on('Grbl:state', function (data) {
    // If we do not yet know the reporting units from the $13 setting, we copy
    // the data for later processing when we do know.
    if (typeof grblReportingUnits === 'undefined') {
      savedGrblState = JSON.parse(JSON.stringify(data));
    } else {
      renderGrblState(data);
    }
    // console.log(data);
  });
  controller.on('Grbl:settings', function (data) {
    var settings = data.settings || {};
    if (settings['$13'] !== undefined) {
      grblReportingUnits = Number(settings['$13']) || 0;
      if (typeof savedGrblState !== 'undefined') {
        renderGrblState(savedGrblState);
        // Don't re-render the state if we get later settings reports,
        // as the savedGrblState is probably stale.
        savedGrblState = undefined;
      }
    }
  });
  controller.on('Smoothie:state', function (data) {
    var status = data.status || {};
    var activeState = status.activeState;
    var mpos = status.mpos;
    var wpos = status.wpos;
    var IDLE = 'Idle',
      RUN = 'Run';
    var canClick = [IDLE, RUN].indexOf(activeState) >= 0;
    $('[data-route="axes"] .control-pad').prop('disabled', !canClick);
    $('[data-route="axes"] .control-pad .btn').prop('disabled', !canClick);
    $('[data-route="axes"] [data-name="active-state"]').text(activeState);
    $('[data-route="axes"] [data-name="mpos-x"]').text(mpos.x);
    $('[data-route="axes"] [data-name="mpos-y"]').text(mpos.y);
    $('[data-route="axes"] [data-name="mpos-z"]').text(mpos.z);
    $('[data-route="axes"] [data-name="wpos-x"]').text(wpos.x);
    $('[data-route="axes"] [data-name="wpos-y"]').text(wpos.y);
    $('[data-route="axes"] [data-name="wpos-z"]').text(wpos.z);
  });
  controller.on('TinyG:state', function (data) {
    var sr = data.sr || {};
    var machineState = sr.machineState;
    var stateText = {
      0: 'Initializing',
      1: 'Ready',
      2: 'Alarm',
      3: 'Program Stop',
      4: 'Program End',
      5: 'Run',
      6: 'Hold',
      7: 'Probe',
      8: 'Cycle',
      9: 'Homing',
      10: 'Jog',
      11: 'Interlock',
    } [machineState] || 'N/A';
    var mpos = sr.mpos;
    var wpos = sr.wpos;
    var READY = 1,
      STOP = 3,
      END = 4,
      RUN = 5;
    var canClick = [READY, STOP, END, RUN].indexOf(machineState) >= 0;
    var mlabel = 'MPos:';
    var wlabel = 'WPos:';
    switch (sr.modal.units) {
    case 'G20':
      mlabel = 'MPos (in):';
      wlabel = 'WPos (in):';
      // TinyG reports machine coordinates in mm regardless of the in/mm mode
      mpos.x = (mpos.x / 25.4).toFixed(4);
      mpos.y = (mpos.y / 25.4).toFixed(4);
      mpos.z = (mpos.z / 25.4).toFixed(4);
      // TinyG reports work coordinates according to the in/mm mode
      wpos.x = Number(wpos.x).toFixed(4);
      wpos.y = Number(wpos.y).toFixed(4);
      wpos.z = Number(wpos.z).toFixed(4);
      break;
    case 'G21':
      mlabel = 'MPos (mm):';
      wlabel = 'WPos (mm):';
      mpos.x = Number(mpos.x).toFixed(3);
      mpos.y = Number(mpos.y).toFixed(3);
      mpos.z = Number(mpos.z).toFixed(3);
      wpos.x = Number(wpos.x).toFixed(3);
      wpos.y = Number(wpos.y).toFixed(3);
      wpos.z = Number(wpos.z).toFixed(3);
    }
    $('[data-route="axes"] .control-pad').prop('disabled', !canClick);
    console.log(`Set .control-pad to disabled? ${!canClick}`);
    $('[data-route="axes"] .control-pad .btn').prop('disabled', !canClick);
    $('[data-route="axes"] [data-name="active-state"]').text(stateText);
    $('[data-route="axes"] [data-name="mpos-label"]').text(mlabel);
    $('[data-route="axes"] [data-name="mpos-x"]').text(mpos.x);
    $('[data-route="axes"] [data-name="mpos-y"]').text(mpos.y);
    $('[data-route="axes"] [data-name="mpos-z"]').text(mpos.z);
    $('[data-route="axes"] [data-name="wpos-label"]').text(wlabel);
    $('[data-route="axes"] [data-name="wpos-x"]').text(wpos.x);
    $('[data-route="axes"] [data-name="wpos-y"]').text(wpos.y);
    $('[data-route="axes"] [data-name="wpos-z"]').text(wpos.z);
  });
  controller.listAllPorts();
  // Workspace
  $('[data-route="workspace"] [data-name="port"]').val('');
  $('[data-route="workspace"] [data-name="btn-close"]').on('click', function () {
    controller.closePort();
  });
  //
  // Connection
  //
  $('[data-route="connection"] [data-name="btn-open"]').on('click', function () {
    var controllerType = $('[data-route="connection"] [data-name="controllerType"]').val();
    var port = $('[data-route="connection"] [data-name="port"]').val();
    var baudrate = $('[data-route="connection"] [data-name="baudrate"]').val();
    $('[data-route="connection"] [data-name="msg"]').val('');
    controller.openPort(port, {
      controllerType: controllerType,
      baudrate: Number(baudrate)
    });
  });
  //
  // Axes
  //
  $('[data-route="axes"] [data-name="btn-dropdown"]').dropdown();
  $('[data-route="axes"] [data-name="active-state"]').text('Not connected');
  $('[data-route="axes"] [data-name="step"]').text('1.000');
});
