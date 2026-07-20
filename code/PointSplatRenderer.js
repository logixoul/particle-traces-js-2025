import * as THREE from 'three';

class PointSplatRenderer {
    constructor(renderer, width, height) {
        this.renderer = renderer;
        this.width = width;
        this.height = height;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    }

    render(particles) {
        
        const geo = buildGeometryFromParticles(particles);

        const mesh = new THREE.Mesh(geo, this.lineMaterial);

        this.scene.add(mesh);

        this.composer.render();

        this.scene.remove(mesh);

        mesh.geometry.dispose();
    }
}

export { PointSplatRenderer };