var iNode = (function() {
	"use strict";

	var self = {};

	var svgURI = 'http://www.w3.org/2000/svg';
	var xhtmlURI = 'http://www.w3.org/1999/xhtml';

	var passiveEvents = false;

	function Renderer(svgObj)
	{
		this.svgObj = svgObj;

		var rect = svgObj.getBoundingClientRect();
		this.svgRect = {top: rect.top, left: rect.left, x: 0, y: 0, width: rect.width, height: rect.height};

		this.setElementAttribute(this.svgObj, {svgRect: this.svgRect.x + ' ' + this.svgRect.y + ' ' + this.svgRect.width + ' ' + this.svgRect.height});

		this.pathsObj = this.createElement(this.svgObj, 'g', {class:'inode_paths'});
		this.nodesObj = this.createElement(this.svgObj, 'g', {class:'inode_nodes'});

		this.node = {};

		this.Link = null;
		this.LinkPos = null;
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

	Renderer.prototype.addNode = function(node, nID)
	{
		node.nID = (typeof nID == 'undefined') ? 'node' + new Date().getTime().toString(36) + parseInt(Math.random() * 72).toString(36) : nID;
		this.node[node.nID] = node;
		node.renderer = this;

		node.gObj = this.createElement(this.nodesObj, 'g', {class:'inode_node inode_'+ node.nID});
		node.fObj = this.createElement(node.gObj, 'foreignObject', {x:10, y:10, width:180, height:180});
		node.fObj.innerHTML = '<div xmlns="http://www.w3.org/1999/xhtml" class="inode_node_content inode_'+ node.nID + '"><ul><li><strong>First</strong> item</li>  <li><em>Second</em> item</li> <li>Thrid item</li> </ul></div>';
	};

	function Node(nID)
	{
		this.renderer = null;
		this.input = {};
		this.output = {};
	};
	
	Node.prototype.handleEvent = function(evt) {
		console.log(evt)
	}

	Node.prototype.addInlet = function(inlet, params)
	{
		this.iID = (typeof iID == 'undefined') ? 'node' + new Date().getTime().toString(36) + parseInt(Math.random() * 72).toString(36) : iID;
		this.input[iID] = {};
		this.input[iID].obj = params.obj;

		this.renderer.addListener(this.input[iID].obj, 'start', this);

		return this;
	};

	Node.prototype.nodeInputStart = function(nID, iID, e) {
		var rect = self.node[nID].input[iID].obj.getBoundingClientRect();

		self.Link = self.createElement(self.pathsObj, 'path', {fill:'transparent'});
		self.LinkPos = self.relativeCoordinates({x:rect.left + rect.width / 2, y: rect.top + rect.height / 2});

		document.body.classList.add('nse');
		self.addEvent(document, 'move', self.nodeInputMove, true);
		self.addEvent(document, 'end', self.nodeInputStop, true);
	};
	
	
	function NodeInlet(nID)
	{
		this.renderer = null;
	};

	NodeInlet.prototype.handleEvent = function(evt) {
		console.log(this,evt);
		/*switch(evt.type) {
			case 'click':
		}*/
	}

	function NodeOutlet(nID)
	{
		this.renderer = null;
	};

	NodeOutlet.prototype.handleEvent = function(evt) {
		console.log(this,evt);
		/*switch(evt.type) {
			case 'click':
		}*/
	}

	self.nodeInputMove = function(e)
	{
		var evt = e || window.event;
		evt.preventDefault();

		var cursorPos = self.relativeCoordinates({x:e.clientX, y:e.clientY});

		self.setElementAttribute(self.Link, {d:bezierCurve(self.LinkPos.x, self.LinkPos.y, cursorPos.x, cursorPos.y)});
	};

	self.nodeInputStop = function(e)
	{
		var evt = e || window.event;
		evt.preventDefault();

		document.body.classList.remove('nse');
		self.removeEvent(document, 'move', self.nodeInputMove, true);
		self.removeEvent(document, 'end', self.nodeInputStop, true);
	};

	self.addLink = function()
	{
		self.createElement(self.pathsObj, 'path', {fill:'transparent', d:bezierCurve(500,500,200,200)});
	};

	self.relativeCoordinates = function(pos)
	{
		pos.x -= self.svgRect.left;
		pos.y -= self.svgRect.top;
		return pos;
	}
	
	function bezierCurve(x0, y0, x1, y1)
	{
		var mx = x0 + (x1 - x0) / 2;
		return 'M' + x0 + ' ' + y0 + ' ' + 'C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1;
	}

	return {
		'Renderer': function(svgObj) {return new Renderer(svgObj);}
		'Node': function(params) {return new Node(params);}
	}

})();
