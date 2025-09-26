//import { AudioThreadManager } from "./AudioThreadManager.js";
import * as THREE from 'three'
import * as SimplexNoise from 'simplex-noise';

const noise3D = SimplexNoise.createNoise3D();

class Particle {
    oldPositions = [];
    constructor() {
        this.position = new THREE.Vector3(Math.random(), Math.random(), Math.random());
        this.velocity = new THREE.Vector3();
        this.position.subScalar(0.5);
        this.acceleration = new THREE.Vector3();
        this.lifespan = 100;
        this.age = 0;
        this.color = new THREE.Color();
        this.color.setHSL(Math.random(), 1, 0.5);

        this.material = new THREE.LineBasicMaterial({ color: this.color });
    }
    update() {
        let noiseScale = 0.3;
        let positionInNoise = this.position.clone().multiplyScalar(noiseScale);
        this.acceleration.set(
            noise3D(positionInNoise.x, positionInNoise.y, positionInNoise.z),
            noise3D(positionInNoise.y + 100, positionInNoise.z + 100, positionInNoise.x + 100),
            noise3D(positionInNoise.z + 200, positionInNoise.x + 200, positionInNoise.y + 200)
        );
        this.acceleration.multiplyScalar(0.001);
        this.oldPositions.push(this.position.clone());
        if (this.oldPositions.length > 10) {
            this.oldPositions.shift();
        }
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
        this.acceleration.set(0, 0, 0);
        this.age++;
    }
    dispose() {
        this.material.dispose();
    }
}

export class App {
    particles = [];
    constructor() {
        for (let i = 0; i < 10000; i++) {
            this.particles.push(new Particle());
        }
        for (let particle of this.particles) {
            for (let i = 0; i < 100; i++) {
                particle.update();
            }
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        document.body.appendChild( this.renderer.domElement );

        this.camera.position.z = 10;

        this.renderer.setAnimationLoop( this.animate.bind(this) );
    }
    
    animate() {
        let toDispose = [];
        let vertexPositions = new Float32Array( this.particles.length * 3 * 2 ); // 3 values per vertex, 2 vertices per line
        let vertexColors = new Uint8Array( this.particles.length * 3 * 2 ); // 3 values per vertex, 2 vertices per line
        let positionIndex = 0; // vertex index
        let colorIndex = 0; // color index
        for (let particle of this.particles) {
            particle.update();

            if (false&&particle.age > particle.lifespan) {
                this.particles.splice(this.particles.indexOf(particle), 1);
            } else {
                //const geometry = new THREE.BufferGeometry().setFromPoints(particle.oldPositions);
                //toDispose.push(geometry);
                //geometry.setAttribute('position', new THREE.Float32BufferAttribute( vertices, 3 ));
                
                //const line = new THREE.Line(geometry, particle.material);
                //this.scene.add(line);
                if(particle.oldPositions.length>=2){
                    for(let i=0;i<particle.oldPositions.length-1;i++){
                        let p1 = particle.oldPositions[i];
                        let p2 = particle.oldPositions[i+1];
                        vertexPositions[positionIndex++] = p1.x;
                        vertexPositions[positionIndex++] = p1.y;
                        vertexPositions[positionIndex++] = p1.z;
                        vertexPositions[positionIndex++] = p2.x;
                        vertexPositions[positionIndex++] = p2.y;
                        vertexPositions[positionIndex++] = p2.z;
                        vertexColors[colorIndex++] = particle.color.r*255;
                        vertexColors[colorIndex++] = particle.color.g*255;
                        vertexColors[colorIndex++] = particle.color.b*255;
                        vertexColors[colorIndex++] = particle.color.r*255;
                        vertexColors[colorIndex++] = particle.color.g*255;
                        vertexColors[colorIndex++] = particle.color.b*255;                        
                    }
                }
            }
            
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute( vertexPositions, 3 ));
        geometry.setAttribute('color', new THREE.BufferAttribute( vertexColors, 3 ));
        toDispose.push(geometry);
        const line = new THREE.LineSegments( geometry, new THREE.LineBasicMaterial( { vertexColors: true } ) );
        this.scene.add( line );
        
        this.renderer.render( this.scene, this.camera );
        this.scene.clear();
        for(let objectToDispose of toDispose){
            objectToDispose.dispose();
        }
    }
}
