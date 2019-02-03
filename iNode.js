function bezierCurve(x0, y0, x1, y1)
{
	var mx = x0 + (x1 - x0) / 2;
	return 'M' + x0 + ' ' + y0 + ' ' + 'C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1;
}

function _iNode()
{
	"use strict";
	var self = this;

	self.nsURI = 'http://www.w3.org/2000/svg';
	self.svgObj = null;
	self.svgRect = {top: 0, left: 0, x: 0, y: 0, width: 100, height: 100};

	self.nodesObj = null;
	self.pathsObj = null;
	self.node = {};
	self.passiveEvents = false;

	self.Link = null;
	self.LinkPos = null;

	self.init = function(svgObj)
	{
		self.svgObj = svgObj;

		var rect = svgObj.getBoundingClientRect();
		self.svgRect.top = rect.top;
		self.svgRect.left = rect.left;
		self.svgRect.x = 0;
		self.svgRect.y = 0;
		self.svgRect.width = rect.width;
		self.svgRect.height = rect.height;

		self.setElementAttribute(self.svgObj, {svgRect: self.svgRect.x + ' ' + self.svgRect.y + ' ' + self.svgRect.width + ' ' + self.svgRect.height});

		self.pathsObj = self.createElement(self.svgObj, 'g', {class:'inode_paths'});
		self.nodesObj = self.createElement(self.svgObj, 'g', {class:'inode_nodes'});
	};

	self.addNode = function(nID, params)
	{
		if (typeof nID == 'undefined') nID = 'node' + new Date().getTime().toString(36) + parseInt(Math.random() * 72).toString(36);
		if (typeof self.node[nID] != 'undefined') return false;
		
		self.node[nID] = {};
		self.node[nID].input = {};
		self.node[nID].output = {};
		self.node[nID].gObj = self.createElement(self.nodesObj, 'g', {class:'inode_node inode_'+ nID});
		self.node[nID].fObj = self.createElement(self.node[nID].gObj, 'foreignObject', {x:10, y:10, width:180, height:180});
		self.node[nID].fObj.innerHTML = '<div xmlns="http://www.w3.org/1999/xhtml" class="inode_node_content inode_'+ nID + '"><ul><li><strong>First</strong> item</li>  <li><em>Second</em> item</li> <li>Thrid item</li> </ul></div>';
		return nID;
	};

	self.addNodeInput = function(nID, iID, params)
	{
		if (typeof self.node[nID] == 'undefined') return false;

		if (typeof iID == 'undefined') iID = 'input' + new Date().getTime().toString(36) + parseInt(Math.random() * 72).toString(36);
		
		self.node[nID].input[iID] = {};
		self.node[nID].input[iID].obj = params.obj;

		self.addEvent(self.node[nID].input[iID].obj, 'start', function(e){self.nodeInputStart(nID,iID,e)});

		return iID;
	};

	self.nodeInputStart = function(nID, iID, e) {
		var rect = self.node[nID].input[iID].obj.getBoundingClientRect();

		self.Link = self.createElement(self.pathsObj, 'path', {fill:'transparent'});
		self.LinkPos = self.relativeCoordinates({x:rect.left + rect.width / 2, y: rect.top + rect.height / 2});

		document.body.classList.add('nse');
		self.addEvent(document, 'move', self.nodeInputMove, true);
		self.addEvent(document, 'end', self.nodeInputStop, true);
	};

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

	self.createElement = function(parent, name, params)
	{
		var obj = document.createElementNS(self.nsURI, name);

		for (var param in params) {
			obj.setAttributeNS(null, param, params[param]);
		}

		parent.appendChild(obj);
		return obj;
	};

	self.setElementAttribute = function(obj, params)
	{
		for (var param in params) {
			obj.setAttributeNS(null, param, params[param]);
		}
	};

	self.addEvent = function(object, event, callback, bubbles, passive)
	{
		passive = typeof passive == 'undefined' ? false : passive;
		
		if (self.passiveEvents) {
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

	self.removeEvent = function(object, event, callback, bubbles, passive)
	{
		passive = typeof passive == 'undefined' ? false : passive;
		if (self.passiveEvents) {
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

	self.relativeCoordinates = function(pos)
	{
		pos.x -= self.svgRect.left;
		pos.y -= self.svgRect.top;
		return pos;
	}
}
var iNode = new _iNode();
