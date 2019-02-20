var BasicController = (function() {
	"use strict";

	var renderer, fn, prototypes;
	
	function DemoNode(node, nodeType, cfg)
	{
		this.rect = cfg;
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
	};

	DemoNode.prototype.destructor = function()
	{
	};

	return {
		'Node': function(node, nodeType, cfg) {return new DemoNode(node, nodeType, cfg);}
		'onNewRenderer': function(state)
		{
			renderer = state.renderer;
			prototypes = state.prototypes;
			fn = state.fn;
		},
	};
})();
