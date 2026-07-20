//import { AudioThreadManager } from "./AudioThreadManager.js";
import * as THREE from 'three'
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

import * as MetaAILineRenderer from './MetaAILineRenderer.js';
import { Particle, TAIL_LENGTH } from './ParticleLogic.js';
import { SharedRenderingCode } from './sharedRenderingCode.js';
import { PointSplatRenderer } from './PointSplatRenderer.js';

export class App {
    particles = [];
    constructor() {
        this.lastTime = 0;

        //!!!!!!!!!!!!!!!!!!
        this.stats = new Stats();
        document.body.appendChild( this.stats.dom );
        //!!!!!!!!!!!!!!!!!!

        for (let i = 0; i < 100; i++) {
            this.particles.push(new Particle());
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        window.r=this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        //this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild( this.renderer.domElement );
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.camera.position.z = 1;
        this.controls.update();

        this.lineMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            vertexColors: true
        });


        this.composer = new EffectComposer( this.renderer );

        //this.camera2D = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);

        //this.composer.addPass( new RenderPass( this.scene, this.camera2D ) );

        this.composer.addPass( new RenderPass( this.scene, this.camera ) );
       
		/*let bleachBypassPass = new ShaderPass( BleachBypassShader );
        bleachBypassPass.uniforms['opacity'].value = 0.8;
        //bleachBypassPass.
        this.composer.addPass( bleachBypassPass );*/
        if(false)this.composer.addPass( new BokehPass( this.scene, this.camera2D, {
            focus: 0.5,
            aperture: 5*0.00001,
            maxblur: 0.01,
            width: window.innerWidth,
            height: window.innerHeight
        } ) );
		this.composer.addPass( new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 0.2, 0.2, 10.1 ) );
        this.composer.addPass( new OutputPass() );

        if ( false&&this.renderer.getContext() instanceof WebGL2RenderingContext ) {
            this.composer.renderTarget1.samples = 8;
            this.composer.renderTarget2.samples = 8;
        }
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.1;
        //this.renderer.toneMapping = THREE.LinearToneMapping
        //this.renderer.setPixelRatio(0.5);
        
        // triple buffering for Intel GPU framedropping
        this.line1 = this.createLineStrip();
        this.line2 = this.createLineStrip();
        
        this.lineToRender = this.line1;
        this.lineToWriteTo = this.line2;

        this.pointSplatRenderer = new PointSplatRenderer(this.composer, this.scene, window.innerWidth, window.innerHeight, this.particles, this.camera);

        //this.renderer.setAnimationLoop( this.animate.bind(this) );
        //this.animate();

        this.sharedRenderingCode = new SharedRenderingCode(this.particles);

        requestAnimationFrame( this.animate.bind(this) );
        //window.setInterval( this.animate.bind(this), 1000/60 );
    }

    createLineStrip() {
        const positions = new Float32Array( TAIL_LENGTH*this.particles.length * 3 * 2 );
        const colors = new Float32Array( TAIL_LENGTH*this.particles.length * 3 * 2);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.lxMonkeyPatch = {
            positions: positions,
            colors: colors
        }

        const lineStrip = new THREE.Mesh( geometry, this.lineMaterial );
        return lineStrip;
    }

    renderLinesNoOverdraw() {
        const { points, colors } = this.sharedRenderingCode.computeTrailPoints();
        const geo = MetaAILineRenderer.myBeveledLineNoOverlap(points, colors, z => z * 0.04, this.camera);

        const mesh = new THREE.Mesh(geo, this.lineMaterial);

        this.scene.add(mesh);

        this.composer.render();

        this.scene.remove(mesh);

        mesh.geometry.dispose();
    }

    renderPointSplat() {
        this.pointSplatRenderer.render();
    }
    
    animate(time) {
        this.controls.update();

        this.updateParticles();

        //this.renderLinesNoOverdraw();
        this.renderPointSplat();
        
        this.stats.update();

        requestAnimationFrame( this.animate.bind(this) );
    }



    updateParticles() {
        let positionIndex = 0; // vertex index

        for (let particleIndex = 0; particleIndex < this.particles.length; particleIndex++) {
            let particle = this.particles[particleIndex];
            if (particle.remainingLife == 0) {
                particle.reinit();
            }
            particle.update();
        }
    }
}
