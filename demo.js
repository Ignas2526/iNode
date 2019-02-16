var DemoNodeConstructor = (function() {
	"use strict";

	function DemoNode(rect)
	{
		this.rect = rect;
	};

	DemoNode.prototype.init = function(node)
	{
		node.nodeContent.innerHTML = '<ul>'+
				'<li><div class="outlet">&gt;</div><strong>First</strong> item<div class="inlet">&gt;</div></li>'+
				'<li><div class="outlet">&gt;</div><em>Second</em> item<div class="inlet">&gt;</div></li>'+
				'<li><div class="outlet">&gt;</div>Thrid item<div class="inlet">&gt;</div></li>'+
			'</ul>';
		node.setRect(this.rect);

		var inlets = node.nodeContent.querySelectorAll('.inlet');
		for (var i = 0; i < inlets.length; i++) {
			var inlet  = node.addInlet(inlets[i], {oneLink:true});
			inlet.direction = 'right';
		}

		var outlets = node.nodeContent.querySelectorAll('.outlet');
		for (var i = 0; i < outlets.length; i++) {
			var outlet  = node.addOutlet(outlets[i], {oneLink:false});
			outlet.direction = 'left';
		}
	}

	return {
		'DemoNode': function(rect) {return new DemoNode(rect);},
	};
})();
