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

const noise3D = SimplexNoise.createNoise3D();

function curlNoise3D(x, y, z, noiseFn, eps = 1e-4) {
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

    return new THREE.Vector3(
        dFz_dy - dFy_dz,
        dFx_dz - dFz_dx,
        dFy_dx - dFx_dy
    );
}

const TAIL_LENGTH = 100;
class Particle {
    oldPositions = [];
    oldColors = [];
    
    constructor() {
        this.position = new THREE.Vector3(Math.random(), Math.random(), Math.random());
        this.velocity = new THREE.Vector3();
        this.position.subScalar(0.5);
        this.acceleration = new THREE.Vector3();
        this.lifespan = 1000;
        this.age = Math.floor(Math.random() * this.lifespan);
        this.color = new THREE.Color();
        this.color.setHSL(Math.random(), 1, 0.5);
    }
    update() {
        let noiseScale = 0.3;
        let positionInNoise = this.position.clone().multiplyScalar(noiseScale);
        this.acceleration = curlNoise3D(positionInNoise.x, positionInNoise.y, positionInNoise.z, noise3D);
        //let positionInNoise2 = this.position.clone().multiplyScalar(noiseScale*3);
        //this.acceleration.add(curlNoise3D(positionInNoise2.x, positionInNoise2.y, positionInNoise2.z, noise3D).clone().multiplyScalar(0.3));
            //noise3D(positionInNoise.y + 100, positionInNoise.z + 100, positionInNoise.x + 100),
            //noise3D(positionInNoise.z + 200, positionInNoise.x + 200, positionInNoise.y + 200)
        //);
        this.acceleration.multiplyScalar(0.01);
        this.oldPositions.push(this.position.clone());
        if (this.oldPositions.length > TAIL_LENGTH) {
            this.oldPositions.shift();
        }
        this.velocity.add(this.acceleration);
        this.color.setHSL((Math.atan2(this.velocity.y, this.velocity.x)/Math.PI+1)*.5, 1, 0.5);
        this.oldColors.push(this.color.clone());
        if (this.oldColors.length > TAIL_LENGTH) {
            this.oldColors.shift();
        }
        this.position.add(this.velocity);
        this.velocity.set(0, 0, 0);
        this.age++;
    }
    dispose() {
        this.material.dispose();
    }
}

export class App {
    particles = [];
    constructor() {
        for (let i = 0; i < 1000; i++) {
            this.particles.push(new Particle());
        }
        for (let particle of this.particles) {
            for (let i = 0; i < TAIL_LENGTH; i++) {
                particle.update();
            }
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
        
    }
    
    animate() {
        this.controls.update();

        let toDispose = [];
        let vertexPositions = new Float32Array( (TAIL_LENGTH+2)*this.particles.length * 3 );
        let vertexColors = new Float32Array( (TAIL_LENGTH+2)*this.particles.length * 3 );
        let positionIndex = 0; // vertex index
        let colorIndex = 0; // color index
        for(let particleIndex=0;particleIndex<this.particles.length;particleIndex++){
            let particle = this.particles[particleIndex];
            if (particle.age > particle.lifespan) {
                particle = this.particles[particleIndex] = new Particle();
            }
            particle.update();

            //const geometry = new THREE.BufferGeometry().setFromPoints(particle.oldPositions);
            //toDispose.push(geometry);
            //geometry.setAttribute('position', new THREE.Float32BufferAttribute( vertices, 3 ));
            
            //const line = new THREE.Line(geometry, particle.material);
            //this.scene.add(line);
            if(particleIndex!=0){
                let pFirst = particle.oldPositions[0];
                vertexPositions[positionIndex++] = pFirst.x;
                vertexPositions[positionIndex++] = pFirst.y;
                vertexPositions[positionIndex++] = pFirst.z;
                vertexColors[colorIndex++] = 0;
                vertexColors[colorIndex++] = 0;
                vertexColors[colorIndex++] = 0;
            }
            if(particle.oldPositions.length>=2){
                for(let i=0;i<particle.oldPositions.length-1;i++){
                    let p1 = particle.oldPositions[i];
                    let c1 = particle.oldColors[i];
                    vertexPositions[positionIndex++] = p1.x;
                    vertexPositions[positionIndex++] = p1.y;
                    vertexPositions[positionIndex++] = p1.z;
                    let iNormalized = 1.0-i/(particle.oldPositions.length-1);
                    let brightness = 1.0*Math.exp(-iNormalized*2.0);
                    let add = i==particle.oldPositions.length-2?100.5:0.0;
                    brightness += add;
                    vertexColors[colorIndex++] = c1.r*brightness;
                    vertexColors[colorIndex++] = c1.g*brightness;
                    vertexColors[colorIndex++] = c1.b*brightness;
                }
                let pLast = particle.oldPositions[particle.oldPositions.length-1];
                vertexPositions[positionIndex++] = pLast.x;
                vertexPositions[positionIndex++] = pLast.y;
                vertexPositions[positionIndex++] = pLast.z;
                vertexColors[colorIndex++] = 0;
                vertexColors[colorIndex++] = 0;
                vertexColors[colorIndex++] = 0;
            }
        }
            
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions( vertexPositions );
        geometry.setColors( vertexColors );
        toDispose.push(geometry);
        const line = new Line2( geometry, new LineMaterial( { depthWrite: false, worldUnits: true, linewidth: 0.02, vertexColors: true, blending: THREE.AdditiveBlending } ) );
        line.scale.set( 1, 1, 1 );
        this.scene.add( line );
        
        this.composer.render();
        this.scene.clear();
        for(let objectToDispose of toDispose){
            objectToDispose.dispose();
        }

        this.calcFps();
    }

    lastFpsUpdate = performance.now();
    framesSinceLastFpsUpdate = 0;
    calcFps(){
        this.framesSinceLastFpsUpdate++;
        let now = performance.now();
        if(now - this.lastFpsUpdate > 1000){
            let fps = this.framesSinceLastFpsUpdate*1000/(now - this.lastFpsUpdate);
            document.getElementById('fps').innerText = fps.toFixed(1);
            this.lastFpsUpdate = now;
            this.framesSinceLastFpsUpdate = 0;
        }
    }
}
