var THREEx	= THREEx	|| {}


THREEx.Linkify	= function(domEvents, mesh, url, withBoundingBox){
	withBoundingBox	= withBoundingBox !== undefined ? withBoundingBox : true
	// compute geometry size
	var geometry	= mesh.geometry
	geometry.computeBoundingBox();
	var size	= new THREE.Vector3();
	size.x	= (geometry.boundingBox.max.x - geometry.boundingBox.min.x)
	size.y	= (geometry.boundingBox.max.y - geometry.boundingBox.min.y)
	size.z	= (geometry.boundingBox.max.z - geometry.boundingBox.min.z)
	
	// create the boundingBox if needed
	if( withBoundingBox ){
		var boundingBox	= new THREE.Mesh(new THREE.CubeGeometry(1,1,1), new THREE.MeshBasicMaterial({
			wireframe	: true
		}))
		boundingBox.material.visible	= false
		boundingBox.scale.copy(size)
		mesh.add(boundingBox)	
	}

	// bind the click
	var eventTarget	= withBoundingBox ? boundingBox : mesh 
	this.eventTarget= eventTarget
	domEvents.bind(eventTarget, 'click touchend', function(event){
		window.open(url, '_blank');
	})

	// bind 'mouseover'
	domEvents.bind(eventTarget, 'mouseover', function(event){
		document.body.style.cursor	= 'pointer';
	}, false)
		
	// bind 'mouseout'
	domEvents.bind(eventTarget, 'mouseout', function(event){		
		document.body.style.cursor	= 'default';
	}, false)
	
	this.destroy	= function(){
		console.log('not yet implemented')
	}
}
