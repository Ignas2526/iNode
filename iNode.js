var iNode = (function() {
	"use strict";

	var self = {};

	var svgURI = 'http://www.w3.org/2000/svg';
	var xhtmlURI = 'http://www.w3.org/1999/xhtml';

	var passiveEvents = false;
	
	var fn = {};
	fn.bezierCurve = function(x0, y0, x1, y1)
	{
		var mx = x0 + (x1 - x0) / 2;
		return x0 + ' ' + y0 + ' ' + 'C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1;
	};
	
	fn.clamp = function(value, min, max)
	{
		return Math.min(max, Math.max(min, value));
	};
	
	fn.addEventListener = function(object, event, callback, bubbles, passive)
	{
		passive = typeof passive == 'undefined' ? false : passive;

		if (passiveEvents) {
			var opts = {passive: passive, capture: bubbles};
		} else {
			var opts = bubbles;
		}

		if (typeof event == 'string') {
			object.addEventListener(event, callback, opts);
		} else {
			for (var i = 0; i < event.length; i++)
				object.addEventListener(event[i], callback, opts);
		}
	};

	fn.removeEventListener = function(object, event, callback, bubbles, passive)
	{
		passive = typeof passive == 'undefined' ? false : passive;
		if (passiveEvents) {
			var opts = {passive: passive, capture: bubbles};
		} else {
			var opts = bubbles;
		}
		if (typeof event == 'string') {
			object.removeEventListener(event, callback, opts);
		} else {
			for (var i = 0; i < event.length; i++)
				object.removeEventListener(event[i], callback, opts);
		}
	};
	
	/********* Renderer *********/
	
	function Renderer(svgObj)
	{
		this.svgObj = svgObj;

		var rect = svgObj.getBoundingClientRect();
		this.rect = {top: rect.top, left: rect.left, width: rect.width, height: rect.height};
		this.viewBox = {x: 0, y: 0, width: rect.width, height: rect.height};
		this.zoom = 1;
		
		this.setSVGviewBox();

		this.pathsObj = this.createElement(this.svgObj, 'g', {class:'inode_paths'});
		this.nodesObj = this.createElement(this.svgObj, 'g', {class:'inode_nodes'});

		this.node = [];
		this.link = [];

		this.tmpLinkObj = this.createElement(this.pathsObj, 'path', {fill:'transparent'});
		this.clicktime = 0;
	};

	Renderer.prototype.createElement = function(parent, name, params)
	{
		var obj = document.createElementNS(svgURI, name);

		for (var param in params) {
			obj.setAttributeNS(null, param, params[param]);
		}

		parent.appendChild(obj);
		return obj;
	};

	Renderer.prototype.setElementAttribute = function(obj, params)
	{
		for (var param in params) {
			obj.setAttributeNS(null, param, params[param]);
		}
		return obj;
	};

	Renderer.prototype.addListener = function(object, event, callback, bubbles, passive)
	{
		passive = typeof passive == 'undefined' ? false : passive;
		
		if (passiveEvents) {
			var opts = {passive: passive, capture: bubbles};
		} else {
			var opts = bubbles;
		}

		switch(event) {
			// Start implies that there will be an end event. Press means either a single click or a tap event.
			case 'start': case 'press':
				object.addEventListener('touchstart', callback, opts);
				object.addEventListener('mousedown', callback, opts);
			break;
			case 'move':
				object.addEventListener('touchmove', callback, opts);
				object.addEventListener('mousemove', callback, opts);
			break;
			case 'end':
				object.addEventListener('touchend', callback, opts);
				object.addEventListener('mouseup', callback, opts);
			break;
		}
	};

	Renderer.prototype.removeLitener = function(object, event, callback, bubbles, passive)
	{
		passive = typeof passive == 'undefined' ? false : passive;
		if (passiveEvents) {
			var opts = {passive: passive, capture: bubbles};
		} else {
			var opts = bubbles;
		}

		switch(event) {
			case 'start': case 'press':
				object.removeEventListener('touchstart', callback, opts);
				object.removeEventListener('mousedown', callback, opts);
			break;
			case 'move':
				object.removeEventListener('touchmove', callback, opts);
				object.removeEventListener('mousemove', callback, opts);
			break;
			case 'end':
				object.removeEventListener('touchend', callback, opts);
				object.removeEventListener('mouseup', callback, opts);
			break;
		}
	};

	Renderer.prototype.addNode = function(id)
	{
		var node = new Node(this);
		this.node[this.node.length] = node;

		return node;
	};
	
	Renderer.prototype.addLink = function(inlet, outlet)
	{
		if (typeof inlet == 'undefined' || typeof outlet == 'undefined') return false;

		// Ensure that such link doesn't exist
		for (var lID = 0; lID < this.link.length; lID++) {
			if (this.link[lID].inlet == inlet && this.link[lID].outlet == outlet) return false;
		}

		var link = new Link(this, inlet, outlet);
		this.link[this.link.length] = link;

		return link;
	};

	Renderer.prototype.removeLink = function(link)
	{
		var pos = this.link.indexOf(link);
		if (pos == -1) return;

		this.link[pos].destructor();
		this.link.splice(pos,1);
	};
	
	Renderer.prototype.relativeCoordinates = function(pos)
	{
		pos.x = (pos.x - this.rect.left) / this.zoom + this.viewBox.x;
		pos.y = (pos.y - this.rect.top) / this.zoom + this.viewBox.y;
		return pos;
	};
	
	Renderer.prototype.findClosestInlet = function(pos)
	{
		var closestInlet = null, distance = Infinity;

		for (var nID = 0; nID < this.node.length; nID++) {
			var node = this.node[nID];

			for (var iID = 0; iID < node.inlet.length; iID++) {
				var inlet = node.inlet[iID];

				var dist = Math.sqrt(Math.pow((pos.x - inlet.pos.cx), 2) + Math.pow((pos.y - inlet.pos.cy), 2));

				if (dist < distance) {
					closestInlet = inlet;
					distance = dist;
				}
			}
		}
		return closestInlet;
	};
	
	Renderer.prototype.findClosestOutlet = function(pos)
	{
		var closestOutlet = null, distance = Infinity;

		for (var nID = 0; nID < this.node.length; nID++) {
			var node = this.node[nID];

			for (var oID = 0; oID < node.outlet.length; oID++) {
				var outlet = node.outlet[oID];

				var dist = Math.sqrt(Math.pow((pos.x - outlet.pos.cx), 2) + Math.pow((pos.y - outlet.pos.cy), 2));

				if (dist < distance) {
					closestOutlet = outlet;
					distance = dist;
				}
			}
		}
		return closestOutlet;
	};
	
	Renderer.prototype.setSVGviewBox = function(viewBox)
	{
		viewBox = viewBox || {};
		if (viewBox.x) this.viewBox.x = viewBox.x;
		if (viewBox.y) this.viewBox.y = viewBox.y;
		if (viewBox.width) this.viewBox.width = viewBox.width;
		if (viewBox.height) this.viewBox.height = viewBox.height;

		this.setElementAttribute(this.svgObj, {viewBox: this.viewBox.x + ' ' + this.viewBox.y + ' ' + this.viewBox.width + ' ' + this.viewBox.height});
	}
	
	Renderer.prototype.setZoom = function(zoom)
	{
		zoom = fn.clamp(zoom, 0.02, 50);
		this.zoom = zoom;
		this.setSVGviewBox({width: this.rect.width / this.zoom, height: this.rect.height / this.zoom});
	}
	
	/********* Node *********/
	
	function Node(renderer)
	{
		this.rect = {x: 0, y: 0, width: 100, height: 100};
		this.inlet = [];
		this.outlet = [];
		this.renderer = renderer;

		this.gObj = this.renderer.createElement(this.renderer.nodesObj, 'g', {class:'inode_node'});
		this.fObj = this.renderer.createElement(this.gObj, 'foreignObject', {x:this.rect.x, y:this.rect.y, width:this.rect.width, height:this.rect.height});

		this.nodeContent = document.createElement('div');
		this.nodeContent.xmlns = xhtmlURI;
		this.nodeContent.className = 'inode_node_content';
		this.nodeContent.style.width = '100px';
		this.nodeContent.style.height = '100px';
		this.fObj.appendChild(this.nodeContent);

		this.renderer.addListener(this.fObj, 'start', this);

		return this;
	};

	Node.prototype.handleEvent = function(evt)
	{
		evt.stopPropagation();
		switch(evt.type) {
			case 'mousedown': case 'touchstart':
				document.body.classList.add('nse');
				this.renderer.addListener(document, 'move', this, true);
				this.renderer.addListener(document, 'end', this, true);
				this.previousPos = {x:evt.clientX, y:evt.clientY};
				break;

			case 'touchmove': case 'mousemove':
				var cursorPos = {x:evt.clientX, y:evt.clientY};
				var deltaPos = {x:cursorPos.x - this.previousPos.x, y: cursorPos.y - this.previousPos.y};
				this.previousPos = cursorPos;

				this.rect.x += deltaPos.x;
				this.rect.y += deltaPos.y;
				this.renderer.setElementAttribute(this.fObj, {x:this.rect.x, y:this.rect.y});
				this.updateLinkPosition(deltaPos);
				break;

			case 'mouseup': case 'touchend':
				document.body.classList.remove('nse');
				this.renderer.removeListener(document, 'move', this, true);
				this.renderer.removeListener(document, 'end', this, true);
				break;
		}
	};

	Node.prototype.updateLinkPosition = function(deltaPos)
	{
		for (var i = 0; i < this.inlet.length; i++) {
			var inlet = this.inlet[i];
			inlet.pos.cx += deltaPos.x;
			inlet.pos.cy += deltaPos.y;

			for (var j = 0; j < this.renderer.link.length; j++) {
				var link = this.renderer.link[j];
				if (link.inlet != inlet) continue;
				link.renderLink();
			}
		}

		for (var i = 0; i < this.outlet.length; i++) {
			var outlet = this.outlet[i];
			outlet.pos.cx += deltaPos.x;
			outlet.pos.cy += deltaPos.y;

			for (var j = 0; j < this.renderer.link.length; j++) {
				var link = this.renderer.link[j];
				if (link.outlet != outlet) continue;
				link.renderLink();
			}
		}
	};


	Node.prototype.setRect = function(rect)
	{
		this.rect = rect;
		this.renderer.setElementAttribute(this.fObj, {x:this.rect.x, y:this.rect.y, width:this.rect.width, height:this.rect.height});
		this.nodeContent.style.width = this.rect.width+ 'px';
		this.nodeContent.style.height = this.rect.height+ 'px';

		return this;
	};
	
	Node.prototype.addInlet = function(DOMobj, cfg)
	{
		var nodeInlet = new NodeInlet(this.renderer, this, DOMobj, cfg);
		this.inlet[this.inlet.length] = nodeInlet;

		return nodeInlet;
	};
	
	Node.prototype.addOutlet = function(DOMobj, cfg)
	{
		var nodeOutlet = new NodeOutlet(this.renderer, this, DOMobj, cfg);
		this.outlet[this.outlet.length] = nodeOutlet;

		return nodeOutlet;
	};
	
	/********* NodeInlet *********/
	
	function NodeInlet(renderer, node, DOMobj, cfg)
	{
		cfg = cfg || {};
		this.pos = {cx: 0, cy: 0};
		this.DOMobj = DOMobj;
		this.node = node;
		this.renderer = renderer;
		this.oneLink = typeof cfg.oneLink != 'undefined' ? cfg.oneLink : false;

		var rect = this.DOMobj.getBoundingClientRect();
		var coords = this.renderer.relativeCoordinates(rect);
		this.pos = {cx: coords.x + (rect.width / 2), cy: coords.y + (rect.height / 2)};
		this.renderer.addListener(this.DOMobj, 'start', this);
	};

	NodeInlet.prototype.handleEvent = function(evt)
	{
		evt.stopPropagation();
		switch(evt.type) {
			case 'mousedown': case 'touchstart':
				document.body.classList.add('nse');
				this.renderer.addListener(document, 'move', this, true);
				this.renderer.addListener(document, 'end', this, true);
				this.renderer.tmpLinkObj.style.display = '';
				this.renderer.setElementAttribute(this.renderer.tmpLinkObj, {d:''});
				break;

			case 'touchmove': case 'mousemove':
				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				this.renderer.setElementAttribute(this.renderer.tmpLinkObj, {d:fn.bezierCurve(this.pos.cx, this.pos.cy, cursorPos.x, cursorPos.y)});

				break;

			case 'mouseup': case 'touchend':
				document.body.classList.remove('nse');
				this.renderer.removeListener(document, 'move', this, true);
				this.renderer.removeListener(document, 'end', this, true);
				this.renderer.tmpLinkObj.style.display = 'none';

				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				var closestOutlet = this.renderer.findClosestOutlet(cursorPos);
				if (closestOutlet) {
					this.renderer.addLink(this, closestOutlet);
				}
				break;
		}
	};
	
	/********* NodeOutlet *********/
	
	function NodeOutlet(renderer, node, DOMobj, cfg)
	{
		cfg = cfg || {};
		this.pos = {cx: 0, cy: 0};
		this.DOMobj = DOMobj;
		this.node = node;
		this.renderer = renderer;
		this.oneLink = typeof cfg.oneLink != 'undefined' ? cfg.oneLink : false;

		var rect = this.DOMobj.getBoundingClientRect();
		var coords = this.renderer.relativeCoordinates(rect);
		this.pos = {cx: coords.x + (rect.width / 2), cy: coords.y + (rect.height / 2)};
		this.renderer.addListener(this.DOMobj, 'start', this);
	};

	NodeOutlet.prototype.handleEvent = function(evt)
	{
		evt.stopPropagation();
		switch(evt.type) {
			case 'mousedown': case 'touchstart':
				document.body.classList.add('nse');
				this.renderer.addListener(document, 'move', this, true);
				this.renderer.addListener(document, 'end', this, true);
				this.renderer.tmpLinkObj.style.display = '';
				this.renderer.setElementAttribute(this.renderer.tmpLinkObj, {d:''});
				break;

			case 'touchmove': case 'mousemove':
				evt.preventDefault();
				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				this.renderer.setElementAttribute(this.renderer.tmpLinkObj, {d:fn.bezierCurve(this.pos.cx, this.pos.cy, cursorPos.x, cursorPos.y)});

				break;

			case 'mouseup': case 'touchend':
				document.body.classList.remove('nse');
				this.renderer.removeListener(document, 'move', this, true);
				this.renderer.removeListener(document, 'end', this, true);
				this.renderer.tmpLinkObj.style.display = 'none';

				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				var closestInlet = this.renderer.findClosestInlet(cursorPos);
				if (closestInlet) {
					this.renderer.addLink(closestInlet, this);
				}
				break;
		}
	};
	
	/********* Link *********/
	
	function Link(renderer, inlet, outlet)
	{
		if (typeof inlet == 'undefined' || typeof outlet == 'undefined') return;

		this.renderer = renderer;

		// Honor inlet one link constraint
		if (inlet.oneLink) {
			for (var lID = 0; lID < this.renderer.link.length; lID++) {
				if (this.renderer.link[lID].inlet == inlet) {
					this.renderer.removeLink(this.renderer.link[lID]);
				}
			}
		}

		// Honor outlet one link constraint
		if (outlet.oneLink) {
			for (var lID = 0; lID < this.renderer.link.length; lID++) {
				if (this.renderer.link[lID].outlet == outlet) {
					this.renderer.removeLink(this.renderer.link[lID]);
				}
			}
		}

		this.inlet = inlet;
		this.outlet = outlet;
		this.pathObj = this.renderer.createElement(this.renderer.pathsObj, 'path', {fill:'transparent'});

		this.renderLink();

		this.renderer.addListener(this.pathObj, 'press', this);
	};
	
	Link.prototype.renderLink = function()
	{
		var mx = this.inlet.pos.cx + (this.outlet.pos.cx - this.inlet.pos.cx) / 2;
		var curve = 'M' + this.inlet.pos.cx + ' ' + this.inlet.pos.cy + ' ' +
			'C' + mx + ' ' + this.inlet.pos.cy + ' ' + mx + ' ' + this.outlet.pos.cy +
			' ' + this.outlet.pos.cx + ' ' + this.outlet.pos.cy;
		this.renderer.setElementAttribute(this.pathObj, {d:curve});
	};
	
	Link.prototype.destructor = function()
	{
		this.renderer.destroyElement(this.pathObj);
		this.inlet = null;
		this.outlet = null;
		this.renderer = null;
	};
	
	Link.prototype.handleEvent = function(evt)
	{
		evt.stopPropagation();
		switch(evt.type) {
			case 'mousedown': case 'touchstart':
				var time = new Date().getTime();
				if ((this.renderer.clicktime - time) < -700) {
					this.renderer.clicktime = time;
					return;
				}
				this.renderer.removeLink(this);
				break;
		}
	};

	return {
		'Renderer': function(svgObj) {return new Renderer(svgObj);},
		
		'prototypes': {
			'Renderer': Renderer.prototype,
			'Node': Node.prototype,
			'NodeInlet': NodeInlet.prototype,
			'NodeOutlet': NodeOutlet.prototype,
			'Link': Link.prototype,
		},
		'fn': fn
	};

})();
