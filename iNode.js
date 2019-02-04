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
		this.link = {};
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

	Renderer.prototype.addNode = function(id)
	{
		var node = new Node(this);
		this.node[node.length] = node;

		return node;
	};
	
	Renderer.prototype.relativeCoordinates = function(pos)
	{
		pos.x -= this.svgRect.left;
		pos.y -= this.svgRect.top;
		return pos;
	}
	
	Renderer.prototype.addLink = function(link, id)
	{
		link.id = (typeof id == 'undefined') ? 'link' + new Date().getTime().toString(36) + parseInt(Math.random() * 72).toString(36) : id;
		link.renderer = this;

		this.link[link.id] = link;
	}
	
	/********* Node *********/
	
	function Node(renderer)
	{
		this.rect = {x: 0, y: 0, width: 100, height: 100};
		this.inlet = {};
		this.outlet = {};
		this.renderer = renderer;

		this.gObj = this.renderer.createElement(this.renderer.nodesObj, 'g', {class:'inode_node'});
		this.fObj = this.renderer.createElement(this.gObj, 'foreignObject', {x:this.rect.x, y:this.rect.y, width:this.rect.width, height:this.rect.height});
		this.fObj.innerHTML = '<div xmlns="http://www.w3.org/1999/xhtml" class="inode_node_content"><ul>'+
		'<li><strong>First</strong> item<div class="inlet"> </div></li>'+
		'<li><em>Second</em> item<div class="inlet"> </div></li>'+
		'<li>Thrid item<div class="inlet"> </div></li>'+
		'</ul></div>';

		return this;
	};
	
	Node.prototype.setRect = function(rect)
	{
		this.rect = rect;
		this.renderer.setElementAttribute(this.fObj, {x:this.rect.x, y:this.rect.y, width:this.rect.width, height:this.rect.height});
		
		return this;
	}
	
	Node.prototype.addInlet = function(inlet, id)
	{
		inlet.id = (typeof id == 'undefined') ? 'inlet' + new Date().getTime().toString(36) + parseInt(Math.random() * 72).toString(36) : id;
		inlet.renderer = this.renderer;
		this.inlet[inlet.id] = inlet;

		this.renderer.addListener(inlet.DOMobj, 'start', inlet);

		var rect = inlet.DOMobj.getBoundingClientRect();
		var coords = this.renderer.relativeCoordinates(rect);
		inlet.pos = {cx: coords.x + (rect.width / 2), cy: coords.y + (rect.height / 2)};
		
		return this;
	};
	
	/********* NodeInlet *********/
	
	function NodeInlet(DOMobj)
	{
		this.renderer = null;
		this.DOMobj = DOMobj;
		this.pos = {cx: 0, cy: 0};
		
	};

	NodeInlet.prototype.handleEvent = function(evt)
	{
		//console.log(this,evt);
		switch(evt.type) {
			case 'mousedown': case 'touchstart':
				document.body.classList.add('nse');
				this.renderer.addListener(document, 'move', this, true);
				this.renderer.addListener(document, 'end', this, true);

				var rect = this.DOMobj.getBoundingClientRect();
				this.Link = this.renderer.createElement(this.renderer.pathsObj, 'path', {fill:'transparent'});
				this.LinkPos = {x: this.pos.cx, y: this.pos.cy};
			break;

			case 'touchmove': case 'mousemove':
				evt.preventDefault();
				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});
				this.renderer.setElementAttribute(this.Link, {d:bezierCurve(this.LinkPos.x, this.LinkPos.y, cursorPos.x, cursorPos.y)});

			break;

			case 'mouseup': case 'touchend':
				document.body.classList.remove('nse');
				this.renderer.removeListener(document, 'move', this, true);
				this.renderer.removeListener(document, 'end', this, true);

				var cursorPos = this.renderer.relativeCoordinates({x:evt.clientX, y:evt.clientY});

				var closestInlet = null; var distance = Infinity;
				for (var nID in this.renderer.node) {
					if (!this.renderer.node.hasOwnProperty(nID)) continue;
					var node = this.renderer.node[nID];
					for (var iID in node.inlet) {
						if (!node.inlet.hasOwnProperty(iID)) continue;
						var inlet = node.inlet[iID];

						var dist = Math.sqrt(Math.pow((cursorPos.x-inlet.pos.cx),2)+Math.pow((cursorPos.y-inlet.pos.cy),2));

						if (dist < distance) {
							closestInlet = inlet;
							distance = dist;
						}
					}
						
					if (closestInlet) {
						this.renderer.setElementAttribute(this.Link, {d:bezierCurve(this.LinkPos.x, this.LinkPos.y, closestInlet.pos.cx, closestInlet.pos.cy)});
					}
				}
			break;
		}
	}
	
	/********* NodeOutlet *********/
	
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
	
	/********* Link *********/
	function Link(nID)
	{
		this.renderer = null;
		this.nodeA = null;
		this.nodeB = null;
	};
	
	function bezierCurve(x0, y0, x1, y1)
	{
		var mx = x0 + (x1 - x0) / 2;
		return 'M' + x0 + ' ' + y0 + ' ' + 'C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1;
	}

	return {
		'Renderer': function(svgObj) {return new Renderer(svgObj);},
		'NodeInlet': function(DOmobj) {return new NodeInlet(DOmobj);},
		'NodeOutlet': function(DOmobj) {return new NodeOutlet(DOmobj);},
		'Link': function() {return new Link();},
	}

})();
