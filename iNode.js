var iNode = (function() {
	"use strict";

	var svgURI = 'http://www.w3.org/2000/svg';
	var xhtmlURI = 'http://www.w3.org/1999/xhtml';

	var passiveEvents = false;
	// Detect if passive events are present. Added with Chrome 51, prevents preventDefault() function in the callback
	try {
		var opts = Object.defineProperty({}, 'passive', {get: function(){passiveEvents = true;}});
		window.addEventListener('test', null, opts);
	} catch (e) {}

	var fn = {};
	fn.bezierCurve = function(x0, y0, x1, y1)
	{
		var mx = x0 + (x1 - x0) / 2;
		return 'M' + x0 + ' ' + y0 + ' ' + 'C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1;
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

	fn.createElement = function(parent, name, params)
	{
		var obj = document.createElementNS(svgURI, name);

		for (var param in params) {
			obj.setAttributeNS(null, param, params[param]);
		}

		parent.appendChild(obj);
		return obj;
	};

	fn.destroyElement = function(DOMobj)
	{
		DOMobj.parentElement.removeChild(DOMobj);
	};

	fn.setElementAttribute = function(obj, params)
	{
		for (var param in params) {
			obj.setAttributeNS(null, param, params[param]);
		}
		return obj;
	};


	/********* Renderer *********/

	function Renderer(svgObj, controller)
	{
		this.svgObj = svgObj;
		
		this.svgObj.style.mozUserSelect = 'none';
		this.svgObj.style.oUserSelect = 'none';
		this.svgObj.style.webkitUserSelect = 'none';
		this.svgObj.style.msUserSelect = 'none';
		this.svgObj.style.userSelect = 'none';

		var rect = svgObj.getBoundingClientRect();
		this.rect = {top: rect.top, left: rect.left, width: rect.width, height: rect.height};
		this.viewBox = {x: 0, y: 0, width: rect.width, height: rect.height};
		this.zoom = 1;
		this.controller = controller;

		this.updateViewBox();

		this.pathsObj = fn.createElement(this.svgObj, 'g', {class:'inode_paths'});
		this.nodesObj = fn.createElement(this.svgObj, 'g', {class:'inode_nodes'});

		this.node = [];
		this.link = [];

		fn.addEventListener(this.svgObj, 'wheel', this);
		this.tmpLinkObj = fn.createElement(this.pathsObj, 'path', {fill:'transparent'});
		this.clicktime = 0;
	};

	Renderer.prototype.addNode = function(nodeType, cfg)
	{
		var node = new Node(this, nodeType, cfg);
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
		if (distance < 100)
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
		if (distance < 100)
			return closestOutlet;
	};

	Renderer.prototype.updateViewBox = function()
	{
		fn.setElementAttribute(this.svgObj, {viewBox: this.viewBox.x + ' ' + this.viewBox.y + ' ' + this.viewBox.width + ' ' + this.viewBox.height});
	};

	Renderer.prototype.setZoom = function(zoom)
	{
		zoom = fn.clamp(zoom, 0.02, 50);
		this.zoom = zoom;
		this.viewBox.width = this.rect.width / this.zoom;
		this.viewBox.height = this.rect.height / this.zoom;
		this.updateViewBox();
	};

	Renderer.prototype.handleEvent = function(evt)
	{
		switch(evt.type) {
			case 'wheel':
				evt.preventDefault();
				if (evt.ctrlKey || evt.metaKey) {
					var pos = this.relativeCoordinates({x: evt.clientX, y: evt.clientY});
					var newZoom = this.zoom - evt.deltaY / 100;
					newZoom = fn.clamp(newZoom, 0.02, 50);

					// The maximum possible zoom for x and y offet, to zoom into bottom-right corner
					var maxX = this.viewBox.width - this.rect.width / newZoom;
					var maxY = this.viewBox.height - this.rect.height / newZoom;

					// Percentage we are from the top-left corner to the bottom-right corner
					var percentX = (pos.x - this.viewBox.x) / this.viewBox.width;
					var percentY = (pos.y - this.viewBox.y) / this.viewBox.height;

					this.viewBox.x += maxX * percentX;
					this.viewBox.y += maxY * percentY;

					this.setZoom(newZoom);
					this.updateViewBox();

				} else {
					this.viewBox.x += evt.deltaX;
					this.viewBox.y += evt.deltaY;
					this.updateViewBox();
				}
				break;
		}
	};

	/********* Node *********/

	function Node(renderer, nodeType, cfg)
	{
		this.rect = {x: 0, y: 0, width: 100, height: 100};
		this.inlet = [];
		this.outlet = [];
		this.renderer = renderer;

		this.gObj = fn.createElement(this.renderer.nodesObj, 'g', {class:'inode_node'});
		this.fObj = fn.createElement(this.gObj, 'foreignObject', {x:this.rect.x, y:this.rect.y, width:this.rect.width, height:this.rect.height});

		this.nodeContent = document.createElement('div');
		this.nodeContent.xmlns = xhtmlURI;
		this.nodeContent.className = 'inode_node_content';
		this.nodeContent.style.width = '100px';
		this.nodeContent.style.height = '100px';
		this.fObj.appendChild(this.nodeContent);

		fn.addEventListener(this.fObj, ['touchstart', 'mousedown'], this);

		this.controller = this.renderer.controller.Node(this, nodeType, cfg);
	
		return this;
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
		fn.setElementAttribute(this.fObj, {x:this.rect.x, y:this.rect.y, width:this.rect.width, height:this.rect.height});
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

	Node.prototype.removeInlet = function(inlet)
	{
		var pos = this.inlet.indexOf(inlet);
		if (pos == -1) return;

		inlet.destructor();
		this.inlet.splice(pos, 1);
	};

	Node.prototype.addOutlet = function(DOMobj, cfg)
	{
		var nodeOutlet = new NodeOutlet(this.renderer, this, DOMobj, cfg);
		this.outlet[this.outlet.length] = nodeOutlet;

		return nodeOutlet;
	};

	Node.prototype.removeOutlet = function(outlet)
	{
		var pos = this.outlet.indexOf(outlet);
		if (pos == -1) return;

		outlet.destructor();
		this.outlet.splice(pos, 1);
	};

	Node.prototype.destructor = function()
	{
		for (var i = 0; i < this.inlet.length; i++) {
			this.inlet[i].destructor();
		}
		this.inlet = null;

		for (var i = 0; i < this.outlet.length; i++) {
			this.outlet[i].destructor();
		}
		this.outlet = null;

		fn.destroyElement(this.gObj);
		this.controller = null;
		this.renderer = null;
	};

	Node.prototype.handleEvent = function(evt)
	{
		evt.stopPropagation();
		switch(evt.type) {
			case 'touchstart': case 'mousedown':
				fn.addEventListener(document, ['touchmove', 'mousemove', 'touchend', 'mouseup'], this, true);
				this.previousPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				break;

			case 'touchmove': case 'mousemove':
				var currentPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				var deltaPos = {x:(currentPos.x - this.previousPos.x), y: (currentPos.y - this.previousPos.y)};
				this.previousPos = currentPos;

				this.rect.x += deltaPos.x;
				this.rect.y += deltaPos.y;
				fn.setElementAttribute(this.fObj, {x:this.rect.x, y:this.rect.y});
				this.updateLinkPosition(deltaPos);
				break;

			case 'touchend': case 'mouseup':
				fn.removeEventListener(document, ['touchmove', 'mousemove', 'touchend', 'mouseup'], this, true);
				break;
		}
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
		fn.addEventListener(this.DOMobj, ['touchstart', 'mousedown'], this);
	};

	NodeInlet.prototype.destructor = function()
	{
		for (var i = 0; i < this.renderer.link.length; i++) {
			var link = this.renderer.link[i];
			if (link.inlet != this) continue;
			this.renderer.removeLink(link);
		}

		fn.removeEventListener(this.DOMobj, ['touchstart', 'mousedown'], this);
		this.node = null;
		this.renderer = null;
	};

	NodeInlet.prototype.handleEvent = function(evt)
	{
		evt.stopPropagation();
		switch(evt.type) {
			case 'touchstart': case 'mousedown':
				fn.addEventListener(document, ['touchmove', 'mousemove', 'touchend', 'mouseup'], this, true);
				this.renderer.tmpLinkObj.style.display = '';
				fn.setElementAttribute(this.renderer.tmpLinkObj, {d:''});
				break;

			case 'mousemove': case 'touchmove':
				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				fn.setElementAttribute(this.renderer.tmpLinkObj, {d:fn.bezierCurve(this.pos.cx, this.pos.cy, cursorPos.x, cursorPos.y)});

				break;

			case 'touchend': case 'mouseup':
				fn.removeEventListener(document, ['touchmove', 'mousemove', 'touchend', 'mouseup'], this, true);
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
		fn.addEventListener(this.DOMobj, ['touchstart', 'mousedown'], this);
	};

	NodeOutlet.prototype.destructor = function()
	{
		for (var i = 0; i < this.renderer.link.length; i++) {
			var link = this.renderer.link[i];
			if (link.outlet != this) continue;
			this.renderer.removeLink(link);
		}

		fn.removeEventListener(this.DOMobj, ['touchstart', 'mousedown'], this);
		this.node = null;
		this.renderer = null;
	};

	NodeOutlet.prototype.handleEvent = function(evt)
	{
		evt.stopPropagation();
		switch(evt.type) {
			case 'touchstart': case 'mousedown':
				fn.addEventListener(document, ['touchmove', 'mousemove', 'touchend', 'mouseup'], this, true);
				this.renderer.tmpLinkObj.style.display = '';
				fn.setElementAttribute(this.renderer.tmpLinkObj, {d:''});
				break;

			case 'touchmove': case 'mousemove':
				evt.preventDefault();
				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				fn.setElementAttribute(this.renderer.tmpLinkObj, {d:fn.bezierCurve(this.pos.cx, this.pos.cy, cursorPos.x, cursorPos.y)});

				break;

			case 'touchend': case 'mouseup':
				fn.removeEventListener(document, ['touchmove', 'mousemove', 'touchend', 'mouseup'], this, true);
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
		this.pathObj = fn.createElement(this.renderer.pathsObj, 'path', {fill:'transparent'});

		this.renderLink();
		fn.addEventListener(this.pathObj, ['touchstart', 'mousedown'], this);
	};

	Link.prototype.renderLink = function()
	{
		var mx = this.inlet.pos.cx + (this.outlet.pos.cx - this.inlet.pos.cx) / 2;
		var curve = 'M' + this.inlet.pos.cx + ' ' + this.inlet.pos.cy + ' ' +
			'C' + mx + ' ' + this.inlet.pos.cy + ' ' + mx + ' ' + this.outlet.pos.cy +
			' ' + this.outlet.pos.cx + ' ' + this.outlet.pos.cy;
		fn.setElementAttribute(this.pathObj, {d:curve});
	};

	Link.prototype.destructor = function()
	{
		fn.destroyElement(this.pathObj);
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
		'Renderer': function(DOMsvg, controller) {return new Renderer(DOMsvg, controller);},
		
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
