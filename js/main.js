import {GLTFLoader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/loaders/GLTFLoader.js";
import {OrbitControls} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/controls/OrbitControls.js";
import {Water} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/objects/Water.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.toneMappingExposure = 20;
renderer.toneMapping = THREE.NoToneMapping;
renderer.antialias = true;

const domEvents = new THREEx.DomEvents(camera, renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.mouseButtons = {
	LEFT: THREE.MOUSE.ROTATE,
	MIDDLE: THREE.MOUSE.DOLLY,
	RIGHT: THREE.MOUSE.ROTATE
}
controls.minDistance = 1;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI * 3 / 4;

const listener = new THREE.AudioListener();
camera.add(listener);


document.body.appendChild( renderer.domElement );
window.addEventListener( 'resize', onWindowResize, false );

let button_models = {};
let model_ideal_rotation = {};
let model_text_should_be_visible = {};
let fonts = {};

let analyser;

function load_texture(path, cb) {
    new THREE.TextureLoader().load(path, cb);
}
function load_font(path, cb) {
    // cache fonts since we use the same font multiple times
    if (Object.keys(fonts).includes(path)) {
        cb(fonts[path]);
    } else {
        new THREE.FontLoader().load(path, function(font) {
            cb(font);
        });
    }
}
function load_model(path, cb) {
    const loader = new GLTFLoader();
    loader.load(
        path,
        function (data) {
            cb(data.scene.children[0]);
        },
        function (xhr) {
            console.log(`Model ${path}: ${( xhr.loaded / xhr.total * 100 )}% loaded`);
        },
        function (error) {
            console.log(error);
        });
}

function init() {
    load_texture('textures/space.jpg', function(texture) {
        texture.encoding = THREE.sRGBEncoding;
        const envMap = new THREE.WebGLCubeRenderTarget( 2500, {
            format: THREE.RGBAFormat,
            generateMipmaps: false,
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter
        } ).fromEquirectangularTexture( renderer, texture ).texture;
        scene.background = envMap;
        scene.envMap = envMap;
        texture.dispose();
        function get_button_model_cb(name, material, position, url, scale=1) {
            return function(model) {
                const group = new THREE.Group();
                group.name = name;
                group.position.x = position.x;
                group.position.y = position.y;
                model_ideal_rotation[name] = {x: 0, y: 0};

                model.material = material;
                model.geometry.scale(scale, scale, scale);
                model.rotation.x = Math.PI / 2;
                group.add(model);

                const bounding_size = new THREE.Box3().setFromObject(model).getSize();
                // add text on mouseover
                const text_material = new THREE.MeshLambertMaterial({
                    emissive: 0xffffff,
                    emissiveIntensity: 0.8,
                    opacity: 0,
                    transparent: true,
                    depthTest: false
                });
                load_font('fonts/Roboto_Regular.json', function(font) {
                    const geometry = new THREE.TextGeometry(name, {
                        font: font,
                        size: bounding_size.x / 9,
                        height: bounding_size.z / 5
                    });
                    const text_mesh = new THREE.Mesh(geometry, text_material);
                    geometry.center();
                    text_mesh.name = 'text';
                    text_mesh.position.x = model.position.x;
                    text_mesh.position.z = model.position.z;
                    text_mesh.position.y = model.position.y - (bounding_size.y * 11 / 18);
                    group.add(text_mesh);
                });
                domEvents.addEventListener(model, 'mousemove touchstart touchmove', function(event) {
                    const x = (event.intersect.point.x - (group.position.x + model.position.x)) / bounding_size.x;
                    const y = (event.intersect.point.y - (group.position.y + model.position.y)) / bounding_size.y;
                    const ideal_x = (-y) * (Math.PI / 6);
                    const ideal_y = x * (Math.PI / 6);
                    model_ideal_rotation[name].x = ideal_x;
                    model_ideal_rotation[name].y = ideal_y;
                    model_text_should_be_visible[name] = true;
                });
                domEvents.addEventListener(model, 'mouseout touchend touchcancel', function(event) {
                    model_ideal_rotation[name].x = 0;
                    model_ideal_rotation[name].y = 0;
                    model_text_should_be_visible[name] = false;
                });
                scene.add(group);
                button_models[name] = group;
                THREEx.Linkify(domEvents, model, url, false);
            }
        }
        // Models
        load_model('models/mercedes_low.glb', function(model) {
            const group = new THREE.Group();
            model.name = 'logo';
            group.name = 'logo_group';
            model.material = new THREE.MeshStandardMaterial({
                color: 0xb31aff,
                metalness: 1,
                roughness: 0.1,
                envMap: envMap,
                envMapIntensity: 50
            });
            model.position.x = 0;
            model.position.y = 1;
            model.rotation.x = Math.PI / 2;
            model.scale.set(0, 0, 0);
            group.add(model);

            // use logo as a speaker
            const song = new THREE.PositionalAudio(listener);
            new THREE.AudioLoader().load('songs/psycho_trip.opus', function(buffer) {
                song.setBuffer(buffer);
                song.setLoop(true);
                song.setVolume(1);
                song.setRefDistance(50);
                /*const helper = new PositionalAudioHelper(song);
                song.add(helper);*/
                song.play();
                analyser = new THREE.AudioAnalyser(song, 128);
            });
            group.add(song);
            scene.add(group);
        });
        load_model('models/soundcloud.glb', get_button_model_cb(
            'soundcloud',
            new THREE.MeshStandardMaterial( {
                color: 0xe68200,
                metalness: 1,
                roughness: 0.1,
                envMap: envMap,
                envMapIntensity: 50
            }),
            {
                x: -2,
                y: -2
            },
            'https://soundcloud.com/weebartist/',
            10
        ));
        load_model('models/spotify.glb', get_button_model_cb(
            'spotify',
            new THREE.MeshStandardMaterial( {
                color: 0x00d40e,
                metalness: 1,
                roughness: 0.1,
                envMap: envMap,
                envMapIntensity: 50
            }),
            {
                x: 0,
                y: -2
            },
            'https://open.spotify.com/artist/1syTPWNsXkvNHNSMgl8jll',
            10
        ));
        load_model('models/bandcamp.glb', get_button_model_cb(
            'bandcamp',
            new THREE.MeshStandardMaterial( {
                color: 0x17bdff,
                metalness: 1,
                roughness: 0.1,
                envMap: envMap,
                envMapIntensity: 50
            }),
            {
                x: 2,
                y: -2
            },
            'https://dweeb123.bandcamp.com/',
            10
        ));

        // Water
        const waterGeometry = new THREE.RingGeometry(0, 500, 128, 64 );
        const water = new Water(
            waterGeometry,
            {
                textureWidth: 64,
                textureHeight: 64,
                waterNormals: new THREE.TextureLoader().load( 'textures/waternormals.jpg', function ( texture ) {

                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

                } ),
                alpha: 1,
                waterColor: 0xb8001c,
                distortionScale: 3.7,
                envMap: envMap,
                fog: scene.fog !== undefined,
                sunDirection: new THREE.Vector3(0, 0, 0),
                sunColor: 0xb8001c
            }
        );
        water.rotation.x = - Math.PI / 2;
        water.position.y = -10;
        water.name = 'water';
        water.material.opacity = 0.5;
        scene.add( water );
    });
}

function animate() {
    setTimeout(() => {
        requestAnimationFrame(animate);
    }, 1000 / 60);
    const time = performance.now() * 0.001;
    controls.update();
    for (const name of Object.keys(button_models)) {
        const model = button_models[name];
        model.rotation.x = (model_ideal_rotation[name].x + model.rotation.x) / 2;
        model.rotation.y = (model_ideal_rotation[name].y + model.rotation.y) / 2;
        const text = model.getObjectByName('text');
        if (text != undefined) {
            if (model_text_should_be_visible[name]) {
                text.material.opacity = (10*text.material.opacity + 1) / 11;
            } else {
                text.material.opacity = (10*text.material.opacity + 0.0) / 11;
            }
        }
    }
    const logo = scene.getObjectByName('logo');
    const logo_group = scene.getObjectByName('logo_group');
    if (logo != undefined && analyser != undefined) {
        const data = analyser.getFrequencyData();
        const water = scene.getObjectByName('water');
        let volume = data.length > 0 ? data.reduce((a, b) => a+b) / data.length / 100.0 : 0.0;
        logo_group.rotation.y += 0.005;
        logo.scale.set(volume, volume, volume);

        if (water != undefined) {
            const waterGeometry = water.geometry;
            for (let i = 0; i < waterGeometry.vertices.length; ++i) {
                let j = (i + 60) % (data.length * 2);
                if (j >= data.length) {
                    j = data.length * 2 - j - 1;
                }
                waterGeometry.vertices[i].z = data[j] / 40 * (i / data.length / 4);
            }
            waterGeometry.verticesNeedUpdate = true;
            waterGeometry.normalsNeedUpdate = true;
            waterGeometry.computeVertexNormals();
            waterGeometry.computeFaceNormals();
            water.material.uniforms[ 'time' ].value += 1.0 / 60.0;
        }
    }
    renderer.render( scene, camera );
}

// event handlers

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

init();
animate();