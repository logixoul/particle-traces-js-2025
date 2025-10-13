//import { AudioThreadManager } from "./AudioThreadManager.js";
import * as THREE from 'three'
import * as SimplexNoise from 'simplex-noise';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
import { MaskPass, ClearMaskPass } from 'three/addons/postprocessing/MaskPass.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';

import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import { BleachBypassShader } from 'three/addons/shaders/BleachBypassShader.js';
import { ColorifyShader } from 'three/addons/shaders/ColorifyShader.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { SepiaShader } from 'three/addons/shaders/SepiaShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
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
/*class Global {

}*/
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
    constructor() {
        this.oldPositions = new Array(TAIL_LENGTH);
        this.oldColors = new Array(TAIL_LENGTH);
        for (let i = 0; i < TAIL_LENGTH; i++) {
            this.oldPositions[i] = new THREE.Vector3();
            this.oldColors[i] = new THREE.Color();
        }
        this.velocity = new THREE.Vector3();
        this.reinit();
    }
    reinit() {
        this.newestIndex = 0;
        this.age = 0;

        let position = this.oldPositions[this.newestIndex];
        position.set(Math.random(), Math.random(), Math.random());
        position.subScalar(0.5);
        this.remainingLife = Math.floor(Math.random() * LIFESPAN);

        for (let i = 0; i < TAIL_LENGTH; i++) {
            this.update();
        }
    }
    update() {
        let position = this.oldPositions[this.newestIndex];
        
        this.newestIndex = (this.newestIndex + 1) % TAIL_LENGTH;
        let color = this.oldColors[this.newestIndex];
        let noiseScale = 0.3;
        curlNoise3D(this.velocity, position.x * noiseScale, position.y * noiseScale, position.z * noiseScale, noise3D);
        this.velocity.multiplyScalar(0.01);
        color.setHSL((Math.atan2(this.velocity.y, this.velocity.x)/Math.PI+1)*.5, 1, 0.5);
        this.oldPositions[this.newestIndex].copy(position);
        
        //this.oldColors[this.newestIndex].copy(color);
        this.oldPositions[this.newestIndex].add(this.velocity);
        this.age++;
        this.remainingLife--;
    }
    dispose() {
        this.material.dispose();
    }
}

export class App {
    particles = [];
    constructor() {
        //!!!!!!!!!!!!!!!!!!
        this.stats = new Stats();
        document.body.appendChild( this.stats.dom );
        //!!!!!!!!!!!!!!!!!!

        for (let i = 0; i < 1000; i++) {
            this.particles.push(new Particle());
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
        
        this.vertexPositions = new Float32Array( TAIL_LENGTH*this.particles.length * 3 * 2 );
        this.vertexColors = new Float32Array( TAIL_LENGTH*this.particles.length * 3 * 2);
        this.geometry = new LineSegmentsGeometry();
        //this.geometry.setUsage(THREE.StreamDrawUsage);
        this.geometry.setPositions( this.vertexPositions );
        this.geometry.setColors( this.vertexColors );
        this.geometry.getAttribute('instanceStart').data.setUsage(THREE.StreamCopyUsage);
        this.geometry.getAttribute('instanceColorStart').data.setUsage(THREE.StreamCopyUsage);

        // these 2 lines reduce the once-every-20ish-frames lag for whatever reason
        this.geometry.getAttribute('instanceStart').data.addUpdateRange(0, this.vertexPositions.length);
        this.geometry.getAttribute('instanceColorStart').data.addUpdateRange(0, this.vertexColors.length);
        
        this.weights = [];
        for(let i=0;i<TAIL_LENGTH;i++){
            let iNormalized = 1.0-i/(TAIL_LENGTH-1);
            let brightness = Math.exp(-iNormalized*2.0);
            let add = i==TAIL_LENGTH-2?100.5:0.0;
            brightness += add;
            this.weights.push(brightness);
        }

        this.line = new LineSegments2( this.geometry, lineMaterial );
        this.scene.add( this.line );
    }
    
    animate() {
        lineMaterial.resolution.set( window.innerWidth, window.innerHeight ); // resolution of the viewport
        
        this.controls.update();

        //let toDispose = [];
        let positionIndex = 0; // vertex index

        for(let particleIndex=0;particleIndex<this.particles.length;particleIndex++){
            let particle = this.particles[particleIndex];
            if (particle.remainingLife == 0) {
                particle.reinit();
            }
            particle.update();
        }
        for(let i=0;i<TAIL_LENGTH-1;i++){
            for(let particleIndex=0;particleIndex<this.particles.length;particleIndex++){
                let particle = this.particles[particleIndex];
        
                let iCircular = (particle.newestIndex - i);
                if(iCircular < 0) iCircular += TAIL_LENGTH;
                iCircular %= TAIL_LENGTH;
                let iNextCircular = iCircular - 1;
                if(iNextCircular < 0) iNextCircular += TAIL_LENGTH;
                
                let p1 = particle.oldPositions[iCircular];
                let c1 = particle.oldColors[iCircular];
                let p2 = particle.oldPositions[iNextCircular];
                let brightness = this.weights[TAIL_LENGTH-i-1];
                this.vertexPositions[positionIndex++] = p1.x;
                this.vertexColors[positionIndex] = c1.r * brightness;
                this.vertexPositions[positionIndex++] = p1.y;
                this.vertexColors[positionIndex] = c1.g * brightness;
                this.vertexPositions[positionIndex++] = p1.z;
                this.vertexColors[positionIndex] = c1.b * brightness;
                this.vertexPositions[positionIndex++] = p2.x;
                this.vertexColors[positionIndex] = c1.r * brightness;
                this.vertexPositions[positionIndex++] = p2.y;
                this.vertexColors[positionIndex] = c1.g * brightness;
                this.vertexPositions[positionIndex++] = p2.z;
                this.vertexColors[positionIndex] = c1.b * brightness;
            }
        }
        
        //this.geometry.getAttribute('instanceStart').data.array = this.vertexPositions;
        //this.geometry.getAttribute('instanceColorStart').data.array = this.vertexColors;

        this.geometry.getAttribute('instanceStart').needsUpdate = true;
        this.geometry.getAttribute('instanceEnd').needsUpdate = true;
        this.geometry.getAttribute('instanceColorStart').needsUpdate = true;
        this.geometry.getAttribute('instanceColorEnd').needsUpdate = true;
        
        //toDispose.push(line);
        //line.scale.set( 1, 1, 1 );

        // copy arrays first (same as above)
// get the InterleavedBuffer that LineSegmentsGeometry created
/*const instStartAttr = this.geometry.getAttribute('instanceStart'); // InterleavedBufferAttribute
const instColorStartAttr = this.geometry.getAttribute('instanceColorStart');
const interleavedPos = instStartAttr.data;      // InstancedInterleavedBuffer
const interleavedColor = instColorStartAttr.data;
interleavedPos.array.set(this.vertexPositions);
interleavedColor.array.set(this.vertexColors);

// manual orphan then let Three.js upload on next update
const gl = this.renderer.getContext();

// get the WebGLBuffer wrapper that Three.js uses internally
const webglPos = this.renderer.attributes.get(interleavedPos);
const webglColor = this.renderer.attributes.get(interleavedColor);

// orphan the underlying GL buffers
gl.bindBuffer(gl.ARRAY_BUFFER, webglPos.buffer);
gl.bufferData(gl.ARRAY_BUFFER, interleavedPos.array.byteLength, gl.DYNAMIC_DRAW);

gl.bindBuffer(gl.ARRAY_BUFFER, webglColor.buffer);
gl.bufferData(gl.ARRAY_BUFFER, interleavedColor.array.byteLength, gl.DYNAMIC_DRAW);

// mark for update so Three.js will upload the new contents
interleavedPos.needsUpdate = true;
interleavedColor.needsUpdate = true;*/
        

        this.composer.render();
        
        /*for(let objectToDispose of toDispose){
            objectToDispose.dispose();
        }*/

        this.stats.update();
    }
}
