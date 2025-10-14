import * as THREE from 'three'
import * as SimplexNoise from 'simplex-noise';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { LineMaterial } from 'MyLineMaterial';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';


import Stats from 'three/addons/libs/stats.module.js';

// monkey patch for optimization:
LineSegmentsGeometry.prototype.computeBoundingSphere = function () {
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Infinity);
};
LineSegmentsGeometry.prototype.computeBoundingBox = function () {
    if ( this.boundingBox === null ) {
        this.boundingBox = new THREE.Box3(new THREE.Vector3( Infinity, Infinity, Infinity ), new THREE.Vector3( -Infinity, -Infinity, -Infinity ) );
    }
};

LineSegmentsGeometry.prototype.setPositions = function( array ) {

		let lineSegments;

		if ( array instanceof Float32Array ) {

			lineSegments = array;

		} else if ( Array.isArray( array ) ) {

			lineSegments = new Float32Array( array );

		}

		const instanceBuffer = new THREE.InstancedInterleavedBuffer( lineSegments, 6, 1 ); // xyz, xyz
        //instanceBuffer.setUsage(THREE.StreamCopyUsage); // lx
		this.setAttribute( 'instanceStart', new THREE.InterleavedBufferAttribute( instanceBuffer, 3, 0 ) ); // xyz
		this.setAttribute( 'instanceEnd', new THREE.InterleavedBufferAttribute( instanceBuffer, 3, 3 ) ); // xyz

		this.instanceCount = this.attributes.instanceStart.count;

		//

		this.computeBoundingBox();
		this.computeBoundingSphere();

		return this;

	};

const noise3D = SimplexNoise.createNoise3D();
const lineMaterial = new LineMaterial( { depthWrite: false, worldUnits: true, linewidth: 0.02, vertexColors: true, blending: THREE.AdditiveBlending } );

function curlNoise3D(dstVector, x, y, z, noiseFn, eps = 1e-4) {
    // Partial derivatives using central differences
    const dx = eps, dy = eps, dz = eps;

    // Noise field components
    //const Fx = noiseFn(x, y, z);
    //const Fy = noiseFn(y + 100, z + 100, x + 100);
    //const Fz = noiseFn(z + 200, x + 200, y + 200);

    // dFz/dy
    const dFz_dy = (noiseFn(z + 200, x + 200, y + 200 + dy) - noiseFn(z + 200, x + 200, y + 200 - dy)) / (2 * dy);
    // dFy/dz
    const dFy_dz = (noiseFn(y + 100, z + 100 + dz, x + 100) - noiseFn(y + 100, z + 100 - dz, x + 100)) / (2 * dz);

    // dFx/dz
    const dFx_dz = (noiseFn(x, y, z + dz) - noiseFn(x, y, z - dz)) / (2 * dz);
    // dFz/dx
    const dFz_dx = (noiseFn(z + 200 + dx, x + 200, y + 200) - noiseFn(z + 200 - dx, x + 200, y + 200)) / (2 * dx);

    // dFy/dx
    const dFy_dx = (noiseFn(y + 100 + dx, z + 100, x + 100) - noiseFn(y + 100 - dx, z + 100, x + 100)) / (2 * dx);
    // dFx/dy
    const dFx_dy = (noiseFn(x, y + dy, z) - noiseFn(x, y - dy, z)) / (2 * dy);

    dstVector.set(
        dFz_dy - dFy_dz,
        dFx_dz - dFz_dx,
        dFy_dx - dFx_dy
    );
}

const TAIL_LENGTH = 100;
const LIFESPAN = 1000;
class Particle {
    constructor(positionFloatArray, colorFloatArray, particleIndex) {
        this.position = new THREE.Vector3();
        this.color = new THREE.Color();
        this.velocity = new THREE.Vector3();
        this.prevPosition = new THREE.Vector3();
        this.particleIndex = particleIndex;
        this.reinit(positionFloatArray, colorFloatArray);
    }
    writePosition(positionFloatArray, index, position) {
        positionFloatArray[index++] = position.x;
        positionFloatArray[index++] = position.y;
        positionFloatArray[index++] = position.z;
        return index;
    }
    reinit(positionFloatArray, colorFloatArray) {
        this.queueFront = 0;
        this.prevWriteIndex = this.calcWriteIndex(this.queueFront);
        this.age = 0;

        this.position.set(Math.random(), Math.random(), Math.random());
        this.position.subScalar(0.5);
        this.prevPosition.copy(this.position);
        this.remainingLife = Math.floor(Math.random() * LIFESPAN);

        //for (let i = 0; i < TAIL_LENGTH; i++) {
            //this.update(positionFloatArray, colorFloatArray);
        //}
    }
    calcWriteIndex(i) {
        const iWrapped = i;// % TAIL_LENGTH;
        return (this.particleIndex * TAIL_LENGTH + iWrapped) * 3 * 2;
    }

    update(positionFloatArray, colorFloatArray) {
        this.prevPosition.copy(this.position);
        
        let writeIndex = this.calcWriteIndex(this.queueFront);
        /*if(this.age != 0) {
            this.prevPosition.set(positionFloatArray[writeIndex + 0], positionFloatArray[writeIndex + 1], positionFloatArray[writeIndex + 2]);
        } else {
            this.prevPosition.copy(this.position);
        }*/
        this.queueFront = (this.queueFront + 1) % TAIL_LENGTH;
        writeIndex = this.calcWriteIndex(this.queueFront);

        
        //this.color = new THREE.Color();
        let noiseScale = 0.3;
        curlNoise3D(this.velocity, this.position.x * noiseScale, this.position.y * noiseScale, this.position.z * noiseScale, noise3D);
        this.velocity.multiplyScalar(0.01);
        this.color.setHSL((Math.atan2(this.velocity.y, this.velocity.x)/Math.PI+1)*.5, 1, 0.5);
        this.position.add(this.velocity);
        this.age++;
        this.remainingLife--;

        //positionFloatArray.copyWithin(writeIndex, this.prevWriteIndex, this.prevWriteIndex + 3);
        positionFloatArray.set(this.prevPosition.toArray(), writeIndex + 0);
        positionFloatArray.set(this.position.toArray(), writeIndex + 3);
        //colorFloatArray.set(this.prevColor.toArray(), writeIndex + 0);
        //colorFloatArray.set(this.color.toArray(), writeIndex + 3);
        colorFloatArray[writeIndex + 0] = this.color.r;
        colorFloatArray[writeIndex + 1] = this.color.g;
        colorFloatArray[writeIndex + 2] = this.color.b;
        colorFloatArray[writeIndex + 3] = this.color.r;
        colorFloatArray[writeIndex + 4] = this.color.g;
        colorFloatArray[writeIndex + 5] = this.color.b;

        this.prevWriteIndex = writeIndex;
        
    }
    dispose() {
        this.material.dispose();
    }
}
const t0 = performance.now();
export class App {
    particles = [];
    constructor() {
        //!!!!!!!!!!!!!!!!!!
        this.stats = new Stats();
        document.body.appendChild( this.stats.dom );
        //!!!!!!!!!!!!!!!!!!
        const PARTICLE_COUNT = 1000;
        this.vertexPositions = new Float32Array( TAIL_LENGTH*PARTICLE_COUNT * 3 * 2 );
        this.vertexColors = new Float32Array( TAIL_LENGTH*PARTICLE_COUNT * 3 * 2);
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            this.particles.push(new Particle(this.vertexPositions, this.vertexColors, i));
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        document.body.appendChild( this.renderer.domElement );
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        
        this.camera.position.z = 1;
        this.controls.update();

        this.renderer.setAnimationLoop( this.animate.bind(this) );
        //window.setInterval( this.animate.bind(this), 1000/60 );

        this.composer = new EffectComposer( this.renderer );
        this.composer.addPass( new RenderPass( this.scene, this.camera ) );
        /*const ssao = new SSAOPass( this.scene, this.camera, window.innerWidth, window.innerHeight );
        ssao.output = SSAOPass.OUTPUT.Default;
        ssao.kernelRadius = 2;
        ssao.saoBias = 0.5;
        ssao.saoIntensity = 1.0;
        //ssao.kernelRadius = 16;
        ssao.minDistance = 0.005;
        ssao.maxDistance = 0.1;
        this.composer.addPass( ssao );*/

        let bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 0.3, 0.5, 0.5 );
		this.composer.addPass( bloomPass );
        //let bleachBypassPass = new ShaderPass( BleachBypassShader );
        //bleachBypassPass.uniforms['opacity'].value = 0.8;
        //this.composer.addPass( bleachBypassPass );
        /*let BokehPass1 = new BokehPass( this.scene, this.camera, {
            focus: 0.5,
            aperture: 0.025,
            maxblur: 0.01,
            width: window.innerWidth,
            height: window.innerHeight
        } );
        this.composer.addPass( BokehPass1 );*/
		const effect3 = new OutputPass();
		this.composer.addPass( effect3 );

        if ( false&&this.renderer.getContext() instanceof WebGL2RenderingContext ) {
            this.composer.renderTarget1.samples = 8;
            this.composer.renderTarget2.samples = 8;
        }
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.1;
        
        this.geometry = new LineSegmentsGeometry();
        //this.geometry.setUsage(THREE.StreamDrawUsage);
        this.geometry.setPositions( this.vertexPositions );
        this.geometry.setColors( this.vertexColors );
        //this.geometry.getAttribute('instanceStart').data.setUsage(THREE.StreamCopyUsage);
        //this.geometry.getAttribute('instanceColorStart').data.setUsage(THREE.StreamCopyUsage);

        // these 2 lines reduce the once-every-20ish-frames lag for whatever reason
        //this.geometry.getAttribute('instanceStart').data.addUpdateRange(0, this.vertexPositions.length);
        //this.geometry.getAttribute('instanceColorStart').data.addUpdateRange(0, this.vertexColors.length);
        
        this.weights = [];
        for(let i=0;i<TAIL_LENGTH;i++){
            let iNormalized = 1.0-i/(TAIL_LENGTH-1);
            let brightness = Math.exp(-iNormalized*2.0);
            let add = i==TAIL_LENGTH-1?100.5:0.0;
            brightness += add;
            this.weights.push(brightness);
        }

        this.line = new LineSegments2( this.geometry, lineMaterial );
        this.scene.add( this.line );
    }
    
    animate() {
        lineMaterial.resolution.set( window.innerWidth, window.innerHeight ); // resolution of the viewport
        
        this.controls.update();

        for(let particleIndex=0;particleIndex<this.particles.length;particleIndex++){
            let particle = this.particles[particleIndex];
            if (particle.remainingLife == 0) {
                particle.reinit(this.vertexPositions, this.vertexColors);
            }
            particle.update(this.vertexPositions, this.vertexColors);
        }
        let positionIndex = 0; // vertex index

        /*for(let i=0;i<TAIL_LENGTH-1;i++){
            let brightness = this.weights[TAIL_LENGTH-i-1];
            for(let particleIndex=0;particleIndex<this.particles.length;particleIndex++){
                positionIndex = this.particles[particleIndex].calcWriteIndex(i);
        
                this.vertexColors[positionIndex++] *= brightness;
                this.vertexColors[positionIndex++] *= brightness;
                this.vertexColors[positionIndex++] *= brightness;
                this.vertexColors[positionIndex++] *= brightness;
                this.vertexColors[positionIndex++] *= brightness;
                this.vertexColors[positionIndex++] *= brightness;
            }
        }*/
        

        this.geometry.getAttribute('instanceStart').needsUpdate = true;
        this.geometry.getAttribute('instanceEnd').needsUpdate = true;
        this.geometry.getAttribute('instanceColorStart').needsUpdate = true;
        this.geometry.getAttribute('instanceColorEnd').needsUpdate = true;
        
        //toDispose.push(line);
        //line.scale.set( 1, 1, 1 );


        this.composer.render();
        //this.renderer.render( this.scene, this.camera );

        const t1 = performance.now();
        const dt = t1 - this.t0;
        if (dt > 90) { // threshold in ms (60fps ~ 16.6ms)
        console.warn('Slow frame:', dt, 'ms');
        }
        
        this.stats.update();
        this.t0 = t1;
    }
}
