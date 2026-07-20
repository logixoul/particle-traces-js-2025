import * as THREE from 'three';
import { SharedRenderingCode } from './sharedRenderingCode.js';
class PointSplatRenderer {
    constructor(composer, width, height, particles, camera) {
        this.composer = composer;
        this.width = width;
        this.height = height;
        this.scene = new THREE.Scene();
        this.camera = camera;
        this.particles = particles;
        this.sharedRenderingCode = new SharedRenderingCode(this.particles);

        this.material = new THREE.PointsMaterial({
            size: 10.0,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    render() {
        const { points, colors } = this.sharedRenderingCode.computeTrailPoints();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(points.map(p => [p.x, p.y, p.z]).flat(), 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors.map(c => [c.r, c.g, c.b]).flat(), 3));

        const mesh = new THREE.Points(geo, this.material);

        this.scene.add(mesh);

        this.composer.render();

        this.scene.remove(mesh);

        mesh.geometry.dispose();
    }
}

export { PointSplatRenderer };