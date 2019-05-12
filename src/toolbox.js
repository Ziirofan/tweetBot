function elementFactory(elementName, parent, w, h, x, y, style, classes){
	var el = document.createElement(elementName);
	parent.appendChild(el);
	el.style.left = x + "px";
	el.style.top = y + "px";
	el.style.width = w + "px";
	el.style.height = h + "px";

	for(var property in style)
		el.style[property] = style[property];
	
	return el;
}

//elementFactory("div", document.body, 10, 10, 100, 35, {backgroundColor:"#000000", borderStyle:"soled 1px red"}, "class1, class2")

