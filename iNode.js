var iNode = (function() {
	"use strict";

	var self = {};

	var svgURI = 'http://www.w3.org/2000/svg';
	var xhtmlURI = 'http://www.w3.org/1999/xhtml';

	var passiveEvents = false;
	
	/********* Renderer *********/
	
	function Renderer(svgObj)
	{
		this.svgObj = svgObj;

		var rect = svgObj.getBoundingClientRect();
		this.svgRect = {top: rect.top, left: rect.left, x: 0, y: 0, width: rect.width, height: rect.height};

		this.setElementAttribute(this.svgObj, {svgRect: this.svgRect.x + ' ' + this.svgRect.y + ' ' + this.svgRect.width + ' ' + this.svgRect.height});

		this.pathsObj = this.createElement(this.svgObj, 'g', {class:'inode_paths'});
		this.nodesObj = this.createElement(this.svgObj, 'g', {class:'inode_nodes'});

		this.node = [];
		this.link = [];

		this.tmpLinkObj = this.createElement(this.pathsObj, 'path', {fill:'transparent'});
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
	
	Renderer.prototype.relativeCoordinates = function(pos)
	{
		pos.x -= this.svgRect.left;
		pos.y -= this.svgRect.top;
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
				this.renderer.setElementAttribute(link.pathObj, {d:bezierCurveLink(inlet, link.outlet)});
			}
		}

		for (var i = 0; i < this.outlet.length; i++) {
			var outlet = this.outlet[i];
			outlet.pos.cx += deltaPos.x;
			outlet.pos.cy += deltaPos.y;

			for (var j = 0; j < this.renderer.link.length; j++) {
				var link = this.renderer.link[j];
				if (link.outlet != outlet) continue;
				this.renderer.setElementAttribute(link.pathObj, {d:bezierCurveLink(link.inlet, outlet)});
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
	
	Node.prototype.addInlet = function(DOMobj)
	{
		var nodeInlet = new NodeInlet(this.renderer, this, DOMobj);
		this.inlet[this.inlet.length] = nodeInlet;

		return nodeInlet;
	};
	
	Node.prototype.addOutlet = function(DOMobj)
	{
		var nodeOutlet = new NodeOutlet(this.renderer, this, DOMobj);
		this.outlet[this.outlet.length] = nodeOutlet;

		return nodeOutlet;
	};
	
	/********* NodeInlet *********/
	
	function NodeInlet(renderer, node, DOMobj)
	{
		this.pos = {cx: 0, cy: 0};
		this.DOMobj = DOMobj;
		this.node = node;
		this.renderer = renderer;

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
				this.renderer.setElementAttribute(this.renderer.tmpLinkObj, {d:bezierCurve(this.pos.cx, this.pos.cy, cursorPos.x, cursorPos.y)});

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
	
	function NodeOutlet(renderer, node, DOMobj)
	{
		this.pos = {cx: 0, cy: 0};
		this.DOMobj = DOMobj;
		this.node = node;
		this.renderer = renderer;

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
				this.renderer.setElementAttribute(this.renderer.tmpLinkObj, {d:bezierCurve(this.pos.cx, this.pos.cy, cursorPos.x, cursorPos.y)});

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
		this.renderer = renderer;
		this.inlet = inlet;
		this.outlet = outlet;
		this.pathObj = this.renderer.createElement(this.renderer.pathsObj, 'path', {fill:'transparent'});

		this.renderer.setElementAttribute(this.pathObj, {d:bezierCurve(inlet.pos.cx, inlet.pos.cy, outlet.pos.cx, outlet.pos.cy)});
	};
	
	function bezierCurve(x0, y0, x1, y1)
	{
		var mx = x0 + (x1 - x0) / 2;
		return 'M' + x0 + ' ' + y0 + ' ' + 'C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1;
	};

	return {
		'Renderer': function(svgObj) {return new Renderer(svgObj);},
	};

})();
