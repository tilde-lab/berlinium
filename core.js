/**
*
* DB GUI
* Author: Evgeny Blokhin
*
*/
var _gui = {};
_gui.version = '0.7.1';
_gui.debug_regime = false;
_gui.rendered = [];
_gui.search_cmd = null;
_gui.tab_buffer = [];
_gui.req_stack = [];
_gui.last_browse_request = false; // todo: request history dispatcher
_gui.socket = null;
_gui.sortdisable = false;
_gui.cwidth = 0;
_gui.cinterval = null;
_gui.connattempts = 0;
_gui.maxconnattempts = 5;
_gui.plots = [];
_gui.mendeleev = {};
_gui.mendeleev_table = ['X', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'];
_gui.last_chkbox = null;
_gui.units = {
    'energy': {'au':0.03674932601, 'eV':1, 'Ry':0.07349861206},
    'phonons': {'cm<sup>-1</sup>':1, 'THz':0.029979}
};
_gui.unit_capts = {'energy':'Energy', 'phonons':'Phonon frequencies'};
_gui.default_settings = {};
_gui.default_settings.units = {'energy':'eV', 'phonons':'cm<sup>-1</sup>'};
_gui.default_settings.cols = [1, 1002, 1501, 1502, 1503, 7, 17, 9, 10, 12, 22, 27]; // these are cid's of hierarchy API (cid>1000 means specially defined column)
_gui.default_settings.colnum = 100;
_gui.default_settings.objects_expand = true;
_gui.ws_server = (window.location.host.indexOf('localhost')==-1) ? 'https://db.tilde.pro' : 'http://localhost:8070';
window.playerdata = {}; // player.html iframe integration

// IE indexOf()
if (!Array.prototype.indexOf){
    Array.prototype.indexOf = function(obj, start){
    for (var i = (start || 0), j = this.length; i < j; i++){
        if (this[i] === obj) { return i; }
    }
    return -1;
    }
}
if (!console) console = {log: function(){}};

// SockJS
_gui.conn = function(login_hash){
    _gui.socket = new SockJS(_gui.ws_server, null, ['websocket', 'xhr-polling']);

    _gui.socket.onopen = function(){
        console.log('CONNECTED.');
        $('#notifybox').hide();
        _gui.connattempts = 0;
        clearInterval(_gui.cinterval);
        _gui.cinterval = null;
        __send('login',  {settings: _gui.settings, login_hash: login_hash} );
    }

    _gui.socket.onmessage = function(payload){
        var response = JSON.parse(payload.data);
        if (_gui.debug_regime) console.log('RECEIVED: '+response.act);

        var n = _gui.req_stack.indexOf(response.act);
        if (n == -1) return console.log('RECEIVED BUT UNKNOWN: '+response.act);
        else _gui.req_stack.splice(n, 1);

        if (!_gui.req_stack.length) $('#loadbox').hide();

        if (response.error && response.error.length>1) return notify('Error in '+response.act+' handler:<br />'+response.error);

        if (window['resp__' + response.act]) window['resp__' + response.act](response.req, response.result);
        else notify('Unhandled action received: ' + response.act);
    }

    _gui.socket.onclose = function(){
        _gui.connattempts += 1;
        if (_gui.connattempts > _gui.maxconnattempts){
            clearInterval(_gui.cinterval);
            notify('Connection to program core cannot be established due to the network restrictions. Sometimes <a href=javascript:window.location.reload()>refresh</a> may help.');
            return;
        }
        console.log('CONNECTION WITH PROGRAM CORE HAS FAILED!');
        if (_gui.debug_regime){
            notify('Program core does not respond. Please, try to <a href=javascript:document.location.reload()>restart</a>.');
        } else {
            if (!_gui.cinterval) _gui.cinterval = setInterval(function(){ _gui.conn() }, 2000);
        }
    }
}
function __send(act, req){
    if (_gui.debug_regime) console.log('REQUESTED: '+act); // invalid for login TODO

    _gui.req_stack.push(act);

    $('#loadbox').show();

    if (act == 'browse') _gui.last_browse_request = req; // todo: request history dispatcher

    try{
        _gui.socket.send( JSON.stringify({'act': act, 'req': req}) );
    } catch(ex){
        console.log('AN ERROR WHILE SENDING DATA HAS OCCURED: '+ex);
    }
}

// ERRORS BOX
function notify(message) {
    $('#errormsg').empty();
    setTimeout(function(){ $('#errormsg').empty().append(message).parent().show(); }, 250);
}

function open_ipane(cmd, target){
    if (!!target) var current = $('#o_'+target+' ul.ipane_ctrl li[rel='+cmd+']');
    else var current = $('ul.ipane_ctrl li[rel='+cmd+']');

    if (!current.length) return notify('Error opening pane '+cmd+'!');

    current.parent().children('li').css('border-bottom-color', '#06c');
    current.css('border-bottom-color', '#fff').parent().parent().children( 'div.ipane' ).hide();
    current.parent().parent().find( 'div[rel='+cmd+']' ).show();

    if (_gui.tab_buffer.indexOf(target+'_'+cmd) != -1) return;

    switch(cmd){
        case 'ph_dos':
        case 'e_dos':
        case 'ph_bands':
        case 'e_bands':
        case 'optstory':
        case 'estory':
            __send(cmd,  {datahash: target} );
            break;
        case 'vib':
            __send('phonons',  {datahash: target} );
            break;
    }
    _gui.tab_buffer.push(target+'_'+cmd);
}

function redraw_vib_links( text2link, target ){
    $('#o_'+target+' td.ph_ctrl').each(function(){
        var $this = $(this);
        var linktxt = $this.text();
        if (!!text2link) $this.empty().append( '<span class=link>'+linktxt+'</span>' );
        else $this.empty().append( linktxt );
    });
    if (!!text2link){
        // attach vibration handler
        $('#o_'+target+' td.ph_ctrl span').click(function(){
            $('#o_'+target+' td.ph_ctrl span').removeClass('red');
            $(this).addClass('red');
            var phonons = '[' + $(this).parent().attr('rev') + ']';
            document.getElementById('f_'+target).contentWindow.vibrate_3D( phonons );
        });
    }
}

function close_obj_tab(tab_id){
    delete _gui.rendered[tab_id];
    delete window.playerdata[tab_id];

    _gui.tab_buffer = $.grep(_gui.tab_buffer, function(val, index){
        if (val.indexOf(tab_id) == -1) return true;
    });
}

function e_plotter(req, plot, divclass, ordinate){
    var show_points = (divclass.indexOf('estory') !== -1) ? false : true;
    var options = {
        legend: {show: false},
        series: {lines: {show: true}, points: {show: show_points}, shadowSize: 3},
        xaxis: {labelHeight: 40, minTickSize: 1, tickDecimals: 0},
        yaxis: {color: '#eeeeee', labelWidth: 50},
        grid: {borderWidth: 1, borderColor: '#000', hoverable: true, clickable: true}
    };
    if (plot[0].data.length == 1) options.xaxis.ticks = []; // awkward optimization cases

    var target = $('#o_'+req.datahash+' div.'+divclass);

    var cpanel = target.prev('div');
    cpanel.parent().removeClass('loading');

    $.plot(target, plot, options);
    /*$(target).bind("plotclick", function(event, pos, item){
        if (item) document.getElementById('f_'+req.datahash).contentWindow.location.replace( '#' + _gui.settings.dbs[0] + '/' + req.datahash + '/' + item.dataIndex );
    });*/

    target.append('<div style="position:absolute;z-index:4;width:200px;left:40%;bottom:0;text-align:center;font-size:1.5em;background:#fff;">Step</div>&nbsp;');
    target.append('<div style="position:absolute;z-index:4;width:200px;left:0;top:300px;text-align:center;font-size:1.25em;transform:rotate(-90deg);transform-origin:left top;-webkit-transform:rotate(-90deg);-webkit-transform-origin:left top;-moz-transform:rotate(-90deg);-moz-transform-origin:left top;background:#fff;">'+ordinate+'</div>');
}

function dos_plotter(req, plot, divclass, axes){
    var options = {
        legend: {show: false},
        series: {lines: {show: true}, points: {show: false}, shadowSize: 0},
        xaxis: {color: '#eeeeee', labelHeight: 40},
        yaxis: {ticks: [], labelWidth: 30},
        grid: {borderWidth: 1, borderColor: '#000'}
    };

    var cpanel = $('#o_'+req.datahash+' div.'+divclass).prev('div');
    cpanel.parent().removeClass('loading');

    for (var i=0; i < plot.length; i++){
        cpanel.prepend('<input type="checkbox" name="' + plot[i].label + '" checked=checked id="cb_' + req.datahash + '_' + plot[i].label + '" rev="' + JSON.stringify(plot[i].data) + '" rel="'+plot[i].color+'" />&nbsp;<label for="cb_'+ req.datahash + '_' + plot[i].label +'" style="color:' + plot[i].color + '">' + plot[i].label + '</label>&nbsp;');
    }
    function plot_user_choice(){
        var data_to_plot = [];
        cpanel.find("input:checked").each(function(){
            var d = $(this).attr('rev');
            data_to_plot.push({color: $(this).attr('rel'), data: JSON.parse( $(this).attr('rev') )});
        });
        var target = $('#o_'+req.datahash+' div.'+divclass);
        $.plot(target, data_to_plot, options);

        target.append('<div style="position:absolute;z-index:14;width:200px;left:40%;bottom:0;text-align:center;font-size:1.5em;background:#fff;">'+axes.x+'</div>&nbsp;');
        target.append('<div style="position:absolute;z-index:14;width:200px;left:0;top:300px;text-align:center;font-size:1.5em;transform:rotate(-90deg);transform-origin:left top;-webkit-transform:rotate(-90deg);-webkit-transform-origin:left top;-moz-transform:rotate(-90deg);-moz-transform-origin:left top;background:#fff;">'+axes.y+'</div>');
    }
    cpanel.find("input").click(plot_user_choice);
    plot_user_choice();
    cpanel.children('div.export_plot').click(function(){ export_data(plot) });
}

function bands_plotter(req, plot, divclass, ordinate){
    var options = {
        legend: {show: false},
        series: {lines: {show: true}, points: {show: false}, shadowSize: 0},
        xaxis: {color: '#eeeeee', labelHeight: 40, font:{size: 9.5, color: '#000'}, labelAngle: 270},
        yaxis: {color: '#eeeeee', labelWidth: 50},
        grid: {borderWidth: 1, borderColor: '#000'}
    };

    var target = $('#o_'+req.datahash+' div.'+divclass);

    var cpanel = target.prev('div');
    cpanel.parent().removeClass('loading');

    options.xaxis.ticks = plot[0].ticks
    //options.xaxis.ticks[options.xaxis.ticks.length-1][1] = '' // avoid cropping in canvas
    $.plot(target, plot, options);

    target.append('<div style="position:absolute;z-index:14;width:200px;left:0;top:300px;text-align:center;font-size:1.25em;transform:rotate(-90deg);transform-origin:left top;-webkit-transform:rotate(-90deg);-webkit-transform-origin:left top;-moz-transform:rotate(-90deg);-moz-transform-origin:left top;background:#fff;">'+ordinate+'</div>');

    target.prev('div').children('div.export_plot').click(function(){ export_data(plot) });
}

function export_data(data){
    var ref = window.open('', 'export' + Math.floor(Math.random()*100));
    var dump = '';
    for (var j=0; j < data[0].data.length; j++){
        dump += data[0].data[j][0] + '\t';
        for (var i=0; i < data.length; i++){
            dump += data[i].data[j][1] + '\t';
        }
        dump += '\n';
    }
    ref.document.body.innerHTML = '<pre>' + dump + '</pre>';
}

function add_tag_expanders(){
    if (!$('#splashscreen_holder').is(':visible')) return;
    $('a.tagmore, a.tagless').remove();
    $('div.tagarea').each(function(){
        if ($(this).find('a.visibletag').length > 20){
            $(this).prepend('<a class=tagmore href=#>&rarr;</a>');
            $(this).addClass('tagarea_reduced');
        } else {
            $(this).removeClass('tagarea_reduced');
        }
    });
}

function switch_menus(which){
    $('div.menu_cmds').hide();
    if (!which) $('#menu_main_cmds').show();
    else if (which == 1) $('#menu_row_cmds').show();
    else if (which == 2) $('#menu_col_cmds').show();
}

function reconstruct_tags(){
    $('a.taglink').removeClass('activetag').addClass('visibletag');
    $('a.mdtag').addClass('visibletag');
    //$('div.tagrow').show();
    $('#initbox').hide();
}

function gather_tags(myself){
    var found_tags = [];

    if (myself){
        if (myself.hasClass('activetag')){
            myself.removeClass('activetag');
        } else {
            found_tags.push( myself.attr('rel') );
        }
    }
    $('#splashscreen').find('a.activetag').each(function(){
        found_tags.push( $(this).attr('rel') );
    });

    return found_tags;
}

function gather_continuous(){
    var condition = [];

    $('div.gui_slider').each(function(){
        var min = parseFloat($(this).attr('min')), max = parseFloat($(this).attr('max'));
        var v = $(this).val();
        if (parseFloat(v[0]) !== min || parseFloat(v[1]) !== max) condition.push({cid: $(this).parent().parent().parent().attr('rel'), min: v[0], max: v[1]});
    });

    return condition;
}

function remdublicates(arr){
    var i, len=arr.length, out=[], obj={};
    for (i=0;i<len;i++){
        obj[arr[i]]=0;
    }
    for (i in obj){
        out.push(i);
    }
    return out;
}

function gather_plots_data(){
    var data = [], ids = [];
    for (var j=0; j < _gui.plots.length; j++){
        data.push([]);
        $('#databrowser td[rel='+_gui.plots[j]+']').each(function(index){
            var t = $(this).text();
            if (t.indexOf('x') != -1){
                // special case of k-points
                var s = t.split('x'), t = 1;
                for (var i=0; i<s.length; i++){ t *= parseInt(s[i]) }
            } else if (t.indexOf(',') != -1) {
                // special case of tilting
                if (t.indexOf('biel') == -1){ // TODO!
                    var s = t.split(',');
                    for (var i=0; i<s.length; i++){ s[i] = parseFloat(s[i]) }
                    t = Math.max.apply(null, s);
                }
            }else {
                // non-numerics
                t = t.replace(/[^0-9\.\-]+/g, '');
                if (!t.length) t=0;
            }
            data[data.length-1].push(t);
            if (j==0) ids.push($(this).parent().attr('id').substr(2)); // i_
        });
    }
    data.push(ids);
    // additional checkups if the data we collected makes sense (note length-1)
    for (var j=0; j < data.length-1; j++){
        var c = remdublicates(data[j]);
        if (c.length == 1){
            notify('All values in a column are equal!');
            return false;
        }
    }
    return data;
}

function clean_plots(){
    if (!_gui.plots.length) return;

    $.each(_gui.plots, function(n, i){
        $('#databrowser td[rel='+i+'], #databrowser th[rel='+i+']').removeClass('selected');
        $('#databrowser th[rel='+i+']').children('input').prop('checked', false);
    });
    _gui.plots = [];
}

function align_page(){
    (_gui.cwidth < 1280) ? $('div.supercat').css('width', '98%') : $('div.supercat').css('width', '49%');
} // FIXME
/**
*
*
* ************************************************************************************************************
*
*/
function url_redraw_react(){
    var anchors = document.location.hash.substr(1).split('/');

    if (!anchors.length) return;

    $('#introbox').hide();

    _gui.tab_buffer = [];

    clean_plots();

    if (anchors[0].length > 40) document.location.replace('#show/' + anchors[0]); // account previous DOI resolving urls

    if (window['url__' + anchors[0]]) window['url__' + anchors[0]](anchors.slice(1));
    else console.log('Unhandled route: ' + document.location.hash);
}

function url__start(arg){
    // MAIN TAGS SCREEN
    $('#grid_holder').hide();
    $('div.downscreen').hide();
    $('#countbox').hide();
    $('#menu_main_cmds').hide();
    $('div.data_ctrl').hide();
    $('#databrowser').empty();

    $('#splashscreen_holder').show();
    $('#introbox').show();
    //add_tag_expanders();
    _gui.rendered = [];
}

function url__grid(arg){
    $('#splashscreen_holder').hide();
    $('#grid_holder').show();
    switch_menus();

    $('#closeobj_trigger').hide();
    _gui.sortdisable = false;
    _gui.rendered = [];
    window.playerdata = {};

    var tags = arg[0].split('+'), start = 0;

    var pgnum = parseInt(arg[1]) || 1;
    if (pgnum > 1) start = pgnum-1;
    var sortby = parseInt($('select.default_order_ctrl').first().val());
    if (sortby == -1) sortby = 0;

    __send('browse', {tids: tags, start: start, sortby: sortby});

    _gui.search_cmd = '#grid/' + arg.join('/');
}

function url__entries(arg){
    $('#splashscreen_holder').hide();
    $('#grid_holder').show();
    switch_menus();

    $('#closeobj_trigger').hide();
    _gui.sortdisable = false;
    _gui.rendered = [];
    window.playerdata = {};

    var hashes = arg[0].split('+');

    __send('browse', {hashes: hashes});

    _gui.search_cmd = '#entries/' + arg.join('/');
}

function url__show(arg){
    $('#splashscreen_holder').hide();
    $('#grid_holder').show();
    switch_menus();

    $('#closeobj_trigger').hide();
    _gui.sortdisable = true;

    var hashes = arg[0].split('+');

    var uniq_hashes = hashes.filter(function(item, pos){ return hashes.indexOf(item) == pos });
    if (hashes.length !== uniq_hashes.length){
        document.location.replace('#show/' + uniq_hashes.join('+'));
        return;
    }
    var absent_hashes = $.grep(hashes, function(el, index){ return !$('#i_' + el).length });
    if (absent_hashes.length) __send('browse', {hashes: hashes});

    $.each(hashes, function(n, item){
        if (_gui.rendered.indexOf(item) == -1) __send('summary', {datahash: item});
    });
}
/**
*
*
* ************************************************************************************************************
*
*/
// RESPONSE FUNCTIONS
function resp__login(req, data){

    //if (_gui.last_request){ // something was not completed in a production mode
    //    var action = _gui.last_request.split( _gui.wsock_delim );
    //    __send(action[0], action[1], true);
    //}
    if (data.debug_regime) _gui.debug_regime = true;

    if (_gui.debug_regime) console.log("RECEIVED SETTINGS: " + JSON.stringify(data.settings));
    for (var attrname in data.settings){ _gui.settings[attrname] = data.settings[attrname] }
    //if (_gui.debug_regime) console.log("FINAL SETTINGS: " + JSON.stringify(_gui.settings));

    // general switches (and settings)
    $('#version').text(data.version);
    document.title = data.title;
    $('#settings_title').val(data.title);
    $('#settings_webport').val(data.settings.webport);

    for (var attrname in _gui.settings.db){
        if (attrname == 'type') continue;
        $('#settings_postgres_'+attrname).val(_gui.settings.db[attrname]);
    }

    // display columns settings (depend on server + client state)
    $('#maxcols').html(_gui.maxcols);

    _gui.settings.avcols.sort(function(a, b){
        if (a.sort < b.sort) return -1;
        else if (a.sort > b.sort) return 1;
        else return 0;
    });

    $.each(_gui.settings.avcols, function(num, item){
        var checked_state = item.enabled ? ' checked=checked' : '';
        $.each(data.cats, function(n, i){
            if (i.includes.indexOf(item.cid) !== -1){
                i.html_pocket += '<li><input type="checkbox" id="s_cb_'+item.cid+'"'+checked_state+'" value="'+item.cid+'" /><label for="s_cb_'+item.cid+'"> ' + item.category + '</label></li>';
            }
        });
    });
    var result_html = '';
    $.each(data.cats, function(n, i){
        if (i.settings_group && i.html_pocket.length) result_html += '<div class="ipane_cols_holder"><span>' + i.category.charAt(0).toUpperCase() + i.category.slice(1) + '</span><ul>' + i.html_pocket + '</ul></div>';
    });
    $('#settings_cols').empty().append( result_html );

    var colnum_str = '';
    $.each([50, 100, 500], function(n, item){
        var checked_state = '';
        if (_gui.settings.colnum == item) checked_state = ' checked=checked';
        colnum_str += ' <input type="radio"'+checked_state+' name="s_rdclnm" id="s_rdclnm_'+n+'" value="'+item+'" /><label for="s_rdclnm_'+n+'"> '+item+'</label>';
    });
    $('#ipane_maxitems_holder').empty().append(colnum_str);
    _gui.settings.objects_expand ? $('#settings_objects_expand').prop('checked', true) : $('#settings_objects_expand').prop('checked', false);

    // display units settings (depend on client state only)
    var units_str = '';
    $.each(_gui.units, function(k, v){
        //units_str += k.charAt(0).toUpperCase() + k.slice(1)+':';
        units_str += _gui.unit_capts[k]+':';
        $.each(v, function(kk, vv){
            var checked_state = '';
            if (_gui.settings.units[k] == kk) checked_state = ' checked=checked';
            units_str += ' <input type="radio"'+checked_state+' name="'+k+'" id="s_rd_'+k+'_'+kk+'" value="'+kk+'" /><label for="s_rd_'+k+'_'+kk+'"> '+kk+'</label>';
        });
        units_str += '<br /><br /><br />';
    });
    $('#ipane_units_holder').empty().append( units_str );

    if ($('#splashscreen').is(':empty')){
        __send('tags', {tids: false});
    }

    document.location.hash ? url_redraw_react() : document.location.replace('#start');
}

function resp__browse(req, data){
    // reset objects
    _gui.rendered = [];
    _gui.tab_buffer = [];
    _gui.plots = [];
    _gui.last_chkbox = null;
    switch_menus();
    $('#initbox').hide();

    // we send table data in raw html (not json due to performance issues) and therefore some silly workarounds are needed
    data = data.split('||||');
    //if (data.length>1) $('#countbox').empty().append(data[1]).show();
    var total_count = parseInt(data[1]);
    req.start = req.start || 0;

    $('#databrowser').empty().append(data[0]).show();

    $('td._e').each(function(){
        var val = parseFloat( $(this).text() );
        if (val) $(this).text( ( Math.round(val * _gui.units.energy[ _gui.settings.units.energy ] * Math.pow(10, 5))/Math.pow(10, 5) ).toFixed(5) );
    });
    $('td._g').each(function(){
        var val = parseFloat( $(this).text() );
        if (val) $(this).text( Math.round(val * _gui.units.energy[ _gui.settings.units.energy ] * Math.pow(10, 4))/Math.pow(10, 4) );
    });

    $('span.units-energy').text(_gui.settings.units.energy);

    if ($('#databrowser td').length > 1) $('#databrowser').tablesorter({sortMultiSortKey:'ctrlKey'});

    // GRAPH CHECKBOXES
    // (UNFORTUNATELY HERE : TODO)
    $('input.sc').click(function(ev){
        ev.stopImmediatePropagation();
        var cat = $(this).parent().attr('rel');
        $('.selected').removeClass('selected');

        $('input.SHFT_cb').prop('checked', false);

        if ($(this).is(':checked')){
            _gui.plots.push(cat);
            if (_gui.plots.length > 2){
                var old = _gui.plots.shift();
                $('#databrowser th[rel='+old+']').children('input').prop('checked', false);
            }
        } else {
            $(this).parent().removeClass('selected');
            var iold = _gui.plots.indexOf(cat);
            _gui.plots.splice(iold, 1);
        }

        $.each(_gui.plots, function(n, i){
            $('#databrowser td[rel='+i+'], #databrowser th[rel='+i+']').addClass('selected');
        });

        if (_gui.plots.length) switch_menus(2);
        else switch_menus();
    });

    if (total_count > _gui.settings.colnum){
        var pcount = Math.ceil(parseInt(total_count) / _gui.settings.colnum);
        var plinks = '';
        var anchor_base = document.location.hash.substr(1).split('/').slice(0, 2).join('/');
        for (var i=1; i<(pcount+1); i++){
            var active_class = '';
            if (i == req.start+1) active_class = ' pglink_active';
            plinks += '<a class="pglink' + active_class + '" href="#' + anchor_base + '/' + i + '">page ' + i + '</a>';
        }
        $('a.pglink').remove();
        $('div.data_ctrl').append(plinks).show();
    } else $('div.data_ctrl').hide();

    var count_msg = 'Matched items: ' + total_count;
    var high_bound = ((req.start+1) * _gui.settings.colnum > total_count) ? total_count : (req.start+1) * _gui.settings.colnum;
    if (total_count > _gui.settings.colnum) count_msg += ' (' + (req.start * _gui.settings.colnum + 1) + ' to ' + high_bound + ' shown)';
    $('#countbox').empty().append(count_msg).show();
}

function resp__tags(req, data){
    if (req.tids && req.tids.length){
        // UPDATE AVAILABLE TAGS
        $('#countbox').hide();
        $('#initbox').show();
        $('a.taglink').removeClass('visibletag'); // reset shown tags

        $.each(data, function(n, i){
            $('a._tag'+i).addClass('visibletag');
        });
        $.each(req.tids, function(n, i){
            $('a.taglink._tag'+i).addClass('visibletag activetag');
        });
    } else {
        // BUILD TAGS FROM SCRATCH
        var tags_html = '';
        _gui.mendeleev = {};

        $.each(data.blocks, function(num, value){
            var tags_piece = 'rel="' + value.cid + '"><div class=tagcapt>' + value.category.charAt(0).toUpperCase() + value.category.slice(1) + ':</div><div';

            if (value.type == 'tag'){

                tags_piece = '<div class="tagrow" ' + tags_piece + ' class="tagarea">';
                value.content.sort(function(a, b){
                    if (a.topic < b.topic) return -1;
                    else if (a.topic > b.topic) return 1;
                    else return 0;
                });
                $.each(value.content, function(n, i){
                    tags_piece += '<a class="tag taglink visibletag _tag' + i.tid + '" rel="' + i.tid + '" href=#>' + i.topic + '</a>';
                });
            } else if (value.type == 'slider') {

                tags_piece = '<div class="sliderow" ' + tags_piece + ' class="tagarea">';
                tags_piece += '<div class="gui_slider_holder"> <div class="gui_slider_min"></div> <div class="gui_slider" id=gui_slider_'+num+' min='+value.min+' max='+value.max+'></div> <div class="gui_slider_max"></div> </div>';
            } else if (value.type == 'mendeleev') {

                tags_piece = '<div class="mendeleevrow" ' + tags_piece + ' class="tagarea">';
                tags_piece += '<div class="mendeleevrow_holder"></div>';
                _gui.mendeleev[parseInt(value.cid)] = value.content;
            }

            tags_piece += '</div></div>';
            $.each(data.cats, function(n, i){
                if (i.includes.indexOf(value.cid) !== -1) i.html_pocket += tags_piece;
            });
        });

        $.each(data.cats, function(n, i){
            if (!i.landing_group || !i.html_pocket.length) return true;
            tags_html += '<div id="supercat_'+i.id+'" class="supercat"> <div class="supercat_title">'+i.category.charAt(0).toUpperCase() + i.category.slice(1)+'</div> <div class="supercat_content">' + i.html_pocket + '</div> </div>';
        });

        if (!tags_html.length) tags_html = '<div class=center style="color:#fff;font-weight:bold;">DB is empty!</div>';
        $('#splashscreen').empty().append(tags_html);

        var mendeleev_cid = 2;
        var obf = $('#mendeleev_table_factory').clone().removeAttr('id').attr('id', 'mendeleev_table_'+mendeleev_cid);
        $('div.mendeleevrow').after(obf);
        obf.show();

        // simple one-level hierarchy
        if (!$.isEmptyObject(_gui.mendeleev)){
        $.each(_gui.mendeleev[mendeleev_cid], function(n, item){
            var key = _gui.mendeleev_table.indexOf(item.symbols[0]);
            obf.find('div.md' + key).html('<a class="mdtag taglink visibletag _tag' + item.tid + '" rel="' + item.tid + '" href=#>' + item.topic + '</a>');
        });
        }

        $('div.gui_slider').each(function(){
            var min = parseFloat($(this).attr('min')), max = parseFloat($(this).attr('max'));
            $(this).prev().text(min.toFixed(1)).end().next().text(max.toFixed(1)).end()
            .noUiSlider({  start:[ min, max ], range: {'min':[min],'max':[max]}, animate: false, connect: true  }).on({
                set: function(){
                    $('#readme').hide();
                    var v = $(this).val();
                    $(this).prev().text(parseFloat(v[0]).toFixed(1)).end().next().text(parseFloat(v[1]).toFixed(1));
                    if (parseFloat(v[0]) !== min || parseFloat(v[1]) !== max) $('#initbox').show();
                },
                slide: function(){ var v = $(this).val(); $(this).prev().text(parseFloat(v[0]).toFixed(1)).end().next().text(parseFloat(v[1]).toFixed(1)); }
            });
        });
        $('div.tagrow, div.sliderow').show();
        align_page();
    }

    if (!$.isEmptyObject(data)) $('#splashscreen').show();

    add_tag_expanders();
}

function resp__summary(req, data){
    var target_cell = $('#i_'+req.datahash);
    if (!target_cell.length) return notify('Data mismatch: received information cannot be properly displayed!');

    var obf = $('<tr class=obj_holder></tr>').append( $('<th colspan=20></th>').append( $('#object_factory').clone().removeAttr('id').attr('id', 'o_'+req.datahash) ) );
    target_cell.after(obf);

    // INPUT IPANE
    if (data.info.input){
        $('#o_'+req.datahash+' ul.ipane_ctrl li[rel=inp]').show();
        data.info.input = data.info.input.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        $('#o_'+req.datahash + ' div[rel=inp]').append('<div class=preformatter style="font-face:Courier New;white-space:pre;height:489px;width:'+(_gui.cwidth/2-65)+'px;margin:20px auto auto 20px;">'+data.info.input+'</div>');
    }

    // OPTGEOM IPANE
    if (data.info.optgeom === true){  $('#o_'+req.datahash+' ul.ipane_ctrl li[rel=optstory]').show() }

    // ESTORY IPANE
    $('#o_'+req.datahash+' ul.ipane_ctrl li[rel=estory]').show();

    // SUMMARY (MAIN) IPANE
    var html = '';
    html += '<div class=preformatter style="height:445px;"><ul class=tags>';
    $.each(data.summary, function(num, value){
        //if ($.inArray(value.content[0], ['&mdash;', '?']) == -1) {
        html += '<li><strong>' + value.category + '</strong>: <span>' + value.content + '</span></li>';
        //}
    });
    if (data.info.warns){
        for (var i=0; i<data.info.warns.length; i++){
            html += '<li class=warn>'+data.info.warns[i]+'</li>';
        }
    }
    html += '</ul></div>';
    $('#o_'+req.datahash + ' div[rel=summary]').append('<div class=summary>'+html+'</div>');
    $('span._e').each(function(){
        var val = parseFloat( $(this).text() );
        if (val) $(this).text( ( Math.round(val * _gui.units.energy[ _gui.settings.units.energy ] * Math.pow(10, 5))/Math.pow(10, 5) ).toFixed(5) );
    });
    $('span._g').each(function(){
        var val = parseFloat( $(this).text() );
        if (val) $(this).text( Math.round(val * _gui.units.energy[ _gui.settings.units.energy ] * Math.pow(10, 4))/Math.pow(10, 4) );
    });
    $('span.units-energy').text(_gui.settings.units.energy);
    open_ipane('summary', req.datahash);

    window.playerdata[req.datahash] = data.cif;

    // 3D IPANE
    open_ipane('3dview', req.datahash);
    _gui.rendered.push(req.datahash);
    $('#o_'+req.datahash + ' div.renderer').empty().append('<iframe id=f_'+req.datahash+' frameborder=0 scrolling="no" width="100%" height="500" src="player.html?'+req.datahash+'"></iframe>');
    //$('#phonons_animate').text('animate');
    window.scrollBy(0, 60);
}

function resp__settings(req, data){
    $.jStorage.set('tilde', _gui.settings);

    if (req.area == 'cols'){
        // re-draw data table without modifying tags
        if (!$('#grid_holder').is(':visible')) return;
        if (_gui.search_cmd){
            var search_base = _gui.search_cmd.substr(1).split('/').slice(0, 2).join('/');
            if (_gui.search_cmd.substr(_gui.search_cmd.length-2) == '/0') document.location.hash = '#' + search_base;
            else document.location.hash = '#' + search_base + '/0';
        } else document.location.reload();
    }
    console.log('SETTINGS SAVED!');
}

function resp__optstory(req, data){
    e_plotter(req, data, 'optstory_holder', '&Delta;E<sub>tot</sub>, eV');
    open_ipane('3dview', req.datahash);
}

function resp__estory(req, data){
    e_plotter(req, data, 'estory_holder', 'log(E<sub>i</sub>-E<sub>i+1</sub>), eV');
}

/**
*
*
* ************************************************************************************************************
*
*/
$(document).ready(function(){

    if (!window.JSON) return;

    _gui.cwidth = document.body.clientWidth;
    console.log('CURRENT WIDTH: ' + _gui.cwidth + ' PX');

    $('#notifybox').hide();

    // initialize client-side settings
    _gui.settings = $.jStorage.get('tilde', _gui.default_settings);
    _gui.maxcols = Math.round(_gui.cwidth/160) || 2;
    if (_gui.settings.cols.length > _gui.maxcols) _gui.settings.cols.splice(_gui.maxcols-1, _gui.settings.cols.length-_gui.maxcols+1);

    window.onhashchange = url_redraw_react;

    _gui.conn();

/**
*
*
* ************************************************************************************************************
*
*/
    // CLOSE OR REMOVE CONTEXT WINDOW
    $('div._close').click(function(){
        (function closer( id ){
            var step_up = id.parent();
            if (!step_up) return;
            if (step_up.hasClass('_closable')) step_up.hide();
            else closer( step_up );
        })( $(this) );
    });

    // DELETE OBJECT TAB
    $(document.body).on('click', 'div._destroy', function(){
        var id = $(this).parent().parent().parent().attr('id').substr(2);

        close_obj_tab(id);

        var anchors = document.location.hash.substr(1).split('/');
        if (anchors.length !== 2) return notify('Unexpected error, please, report this to the developers!');

        var hashes = anchors[1].split('+').filter(function(item){
            return (item.slice(0, id.length) !== id);
        });

        if (!hashes.length) document.location.hash = _gui.search_cmd ? _gui.search_cmd : '#entries/' + id;
        else document.location.hash = '#show/' + hashes.join('+');
    });
/**
*
*
* ************************************************************************************************************
*
*/
    // DATABROWSER TABLE
    $('#databrowser').on('click', 'td', function(){
        if ($(this).parent().attr('id')) var id = $(this).parent().attr('id').substr(2);
        else return;
        $('#d_cb_' + id).trigger('click');
    });

    // DATABROWSER CHECKBOXES
    $('#databrowser').on('click', 'input.SHFT_cb', function(event){
        event.stopPropagation();
        if (_gui.plots.length) clean_plots();

        if ($(this).is(':checked')) $(this).parent().parent().addClass('selected');
        else $(this).parent().parent().removeClass('selected');

        if (event.shiftKey && _gui.last_chkbox){
            var $chkboxes = $('input.SHFT_cb');
            var start = $chkboxes.index(this);
            var end = $chkboxes.index(_gui.last_chkbox);
            $chkboxes.slice(Math.min(start,end) + 1, Math.max(start,end)).trigger('click');
        }

        _gui.last_chkbox = this;

        var flag = ($('input.SHFT_cb').is(':checked')) ? 1 : false;
        switch_menus(flag);
    });
    $('#databrowser').on('click', '#d_cb_all', function(){
        if (_gui.plots.length) clean_plots();

        if ($(this).is(':checked') && $('#databrowser td').length > 1) {
            $('input.SHFT_cb').prop('checked', true);
            $('#databrowser tr').addClass('selected');
            switch_menus(1);
        } else {
            $('input.SHFT_cb').prop('checked', false);
            $('#databrowser tr').removeClass('selected');
            switch_menus();
        }
    });

    // IPANE COMMANDS
    $(document.body).on('click', 'ul.ipane_ctrl li', function(){
        var cmd = $(this).attr('rel');
        var target = $(this).parents('.object_factory_holder');
        target = (target.length) ? target.attr('id').substr(2) : false;
        open_ipane(cmd, target);
    });
/**
*
*
* ************************************************************************************************************
*
*/
    $('#expand_trigger').click(function(){
        var $that = $('input.SHFT_cb:checked');
        if ($that.length > 1) return notify('Please select only one item at the time');
        var id = $that.attr('id').substr(5);

        $('input.SHFT_cb').prop('checked', false);
        $('#databrowser tr').removeClass('selected');
        switch_menus();

        if (_gui.rendered.indexOf(id) > -1) return;

        var anchors = document.location.hash.substr(1).split('/');
        if (anchors[0] == 'show' && anchors[1]){
            if (anchors[1].indexOf(id) == -1) document.location.hash += '+' + id;
            else return;
        } else {
            document.location.hash = '#show/' + id;
        }
    });

    // DATABROWSER MENU
    $('#noclass_trigger').click(function(){
        $('#menu_main_cmds').hide();
        _gui.req_stack = [];
        $('#loadbox').hide();
        reconstruct_tags();
        add_tag_expanders();
        document.location.hash = '#start';
    });
    /*$('#closeobj_trigger').click(function(){
        $(this).hide();
        var anchors = document.location.hash.substr(1).split('/');
        if (anchors.length != 2) return notify('Unexpected behaviour, please, report this to the developers!');

        var hashes = anchors[1].split('+');
        $.each(hashes, function(n, i){
            close_obj_tab(i);
        });
        document.location.replace( '#' + _gui.settings.dbs[0] + '/grid' );
    });*/

    // CANCEL CONTEXT MENU
    $('#cancel_rows_trigger').click(function(){
        $('input.SHFT_cb, #d_cb_all').prop('checked', false);
        $('#databrowser tr').removeClass('selected');
        switch_menus();
    });
    $('#cancel_cols_trigger').click(function(){
        clean_plots();
        switch_menus();
    });

    // EXPORT DATA FUNCTIONALITY
    $('#export_cols_trigger').click(function(){
        if (!_gui.plots.length) return;
        var data = gather_plots_data(), dump = '';
        if (!data) return;

        var ref = window.open('', 'export' + Math.floor(Math.random()*100));
        for (var j=0; j < data[0].length; j++){
            for (var i=0; i < data.length-1; i++){ // skip ids!
                dump += data[i][j] + '\t';
            }
            dump += '\n';
        }
        ref.document.body.innerHTML = '<pre>' + dump + '</pre>';
    });

    // PLOT COLUMNS (ONLY TWO AT THE TIME)
    $('#plot_trigger').click(function(){
        if (_gui.plots.length == 1) return notify('Please, select yet another column to plot!');

        var plot = [{'color': '#0066CC', 'data': [], 'ids': []}], data = gather_plots_data(); // note ids!
        if (!data) return;

        for (var j=0; j < data[0].length; j++){
            var row = [];
            for (var i=0; i < data.length-1; i++){
                row.push(data[i][j]);
            }
            plot[0].data.push(row);
        }

        // this is to handle data clicks
        plot[0].ids = data[data.length-1];

        var options = {
            legend: {show: false},
            series: {lines: {show: false}, points: {show: true, fill: true, fillColor: '#0066CC'}, shadowSize: 3},
            xaxis: {labelHeight: 40},
            yaxis: {color: '#eeeeee', labelWidth: 50},
            grid: {borderWidth: 1, borderColor: '#000', hoverable: true, clickable: true}
        }
        var target = $('#column_plot');
        target.css('height', window.innerHeight*0.75 + 'px');

        $.plot(target, plot, options);
        $(target).unbind("plotclick").bind("plotclick", function(event, pos, item){
            if (item){
                var t = $('#d_cb_' + plot[0].ids[item.dataIndex]);
                $('html, body').animate({scrollTop: t.offset().top-100}, 1000);
                t.trigger('click');
            }
        });

        var x_label = $('#databrowser th[rel='+_gui.plots[0]+']').children('span').html(), y_label = $('#databrowser th[rel='+_gui.plots[1]+']').children('span').html(), h = target.height()/2+53; // rotate!
        target.append('<div style="position:absolute;z-index:499;width:300px;left:40%;bottom:0;text-align:center;font-size:1.25em;background:#fff;">'+x_label+'</div>&nbsp;');
        target.append('<div style="position:absolute;z-index:499;width:300px;left:0;top:'+h+'px;text-align:center;font-size:1.25em;transform:rotate(-90deg);transform-origin:left top;-webkit-transform:rotate(-90deg);-webkit-transform-origin:left top;-moz-transform:rotate(-90deg);-moz-transform-origin:left top;background:#fff;">'+y_label+'</div>');

        $('#column_plot_holder').show();
    });

    // HIDE ITEM
    $('#hide_trigger').click(function(){
        $('div._closable').hide();
        if (_gui.rendered.length){
            $('#closeobj_trigger').trigger('click');
        }

        $('input.SHFT_cb').each(function(){
            if ($(this).is(':checked')) $(this).parent().parent().remove();
        });

        switch_menus();
        if ($('#databrowser tbody').is(':empty')) $('#databrowser tbody').append('<tr><td colspan=100 class=center>No data to display!</td></tr>');
        $('#databrowser').trigger('update');
    });
/**
*
*
* ************************************************************************************************************
*
*/
    // SPLASHSCREEN TAGCLOUD EXPANDERS
    $('#splashscreen').on('click', 'a.tagmore', function(){
        $(this).parent().removeClass('tagarea_reduced').prepend('<a class=tagless href=#>&larr;</a>');
        $(this).remove();
        return false;
    });
    $('#splashscreen').on('click', 'a.tagless', function(){
        $(this).parent().addClass('tagarea_reduced').prepend('<a class=tagmore href=#>&rarr;</a>');
        $(this).remove();
        return false;
    });
    $('#splashscreen').on('click', 'div.tagarea, div.tagcapt', function(e){
        e.stopPropagation();
    });

    // SPLASHSCREEN TAG COMMANDS SINGLE CLICK
    $('#splashscreen').on('click', 'a.taglink', function(){
        if (!$(this).hasClass('visibletag')) return false;
        $('#readme').hide();
        var tags = gather_tags($(this));
        if (tags.length){
            __send('tags', {tids: tags});
        } else {
            reconstruct_tags();
            add_tag_expanders();
        }
        return false;
    });

    // SPLASHSCREEN INIT TAG QUERY
    $('#init_trigger').click(function(){
        var tags = gather_tags();
        var condition = gather_continuous();
        //__send('browse', {tids: tags, condition: condition});
        if (tags.length){
            document.location.hash = '#grid/' + tags.join('+');
        } else notify('Please, choose the topic(s)');
    });

    // SPLASHSCREEN CANCEL TAG QUERY
    $('#cnl_trigger').click(function(){
        reconstruct_tags();
        add_tag_expanders();
        $('div.gui_slider').each(function(){
            var min = parseFloat($(this).attr('min')), max = parseFloat($(this).attr('max'));
            $(this).noUiSlider({ start: [min, max] }, true);
        });
    });
/**
*
*
* ************************************************************************************************************
*
*/
    // SETTINGS: GENERAL TRIGGERS
    $('#settings_trigger').click(function(){
        if ($('#profile_holder').is(':visible')){
            $('#profile_holder').hide();
        } else {
            $('#profile_holder').show();
            open_ipane('cols');
        }
    });

    // SETTINGS: MAXCOLS
    $('#settings_cols').on('click', 'input', function(){
        if ($('#settings_cols input:checked').length > _gui.maxcols){
            $('#maxcols').parent().css('background-color', '#f99');
            return false;
        }
        $('#maxcols').parent().css('background-color', '#fff');
    });

    // SETTINGS: EXPLICIT CLICK TO SAVE
    $('div.settings_apply').click(function(){
        if ($('#settings_cols').is(':visible')){

            // SETTINGS: COLS
            var sets = [];
            $('#settings_cols input').each(function(){
                if ($(this).is(':checked')) sets.push( parseInt( $(this).attr('value') ) );
            });
            if (!sets.length) return notify('Please, choose at least anything to display.');
            _gui.settings.cols = sets;

            __send('settings', {area: 'cols', settings: _gui.settings} );

            $('#profile_holder').hide();

        } else if ($('#ipane_maxitems_holder').is(':visible')){

            // SETTINGS: TABLE
            $('#ipane_maxitems_holder > input').each(function(){
                if ($(this).is(':checked')){
                    _gui.settings.colnum = parseInt( $(this).attr('value') );
                }
            });

            // SETTINGS: EXPAND OBJECTS
            _gui.settings.objects_expand = $('#settings_objects_expand').is(':checked');

            __send('settings', {area: 'cols', settings: _gui.settings} );

            $('#profile_holder').hide();
        } else if ($('#ipane_units_holder').is(':visible')){
            $('#profile_holder').hide();

            // re-draw data table without modifying tags
            if (!_gui.last_browse_request) return;
            if (!$('#databrowser').is(':visible')) return;
            __send('browse', _gui.last_browse_request, true);
        }
    });

    // UNIVERSAL ENTER HOTKEY: NOTE ACTION BUTTON *UNDER THE SAME DIV* WITH THE FORM
    $(document.body).on('submit', 'form._hotkeyable', function(){
        $(this).parent().children('div._hotkey').trigger("click");
        return false;
    });

    // SETTINGS: UNITS
    $('#ipane_units_holder').on('click', 'input', function(){
        var sets = _gui.settings.units;
        $('#ipane_units_holder > input').each(function(){
            if ($(this).is(':checked')){
                var name = $(this).attr('name');
                var value = $(this).attr('value');
                sets[ name ] = value;
            }
        });
        _gui.settings.units = sets;
        $.jStorage.set('tilde', _gui.settings);
    });
/**
*
*
* ************************************************************************************************************
*
*/
    // RESIZE
    $(window).resize(function(){
        if (Math.abs(_gui.cwidth - document.body.clientWidth) < 30) return; // width of scrollbar
        _gui.cwidth = document.body.clientWidth;
        add_tag_expanders();
        _gui.maxcols = Math.round(_gui.cwidth/160) || 2;
        $('#maxcols').html(_gui.maxcols);
        align_page();
        console.log('NEW WIDTH: ' + _gui.cwidth + ' PX');
    });

    // Q/q/ESC HOTKEYS TO CLOSE ALL (ESC KEY NOT WORKING IN FF)
    $(document).keyup(function(ev){
        if (ev.keyCode == 27 || ev.keyCode == 81 || ev.keyCode == 113){
            $('div._closable').hide();
        }
        return false;
    });
});
