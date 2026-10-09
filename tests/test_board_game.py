"""Functional regression checks for the static board game and its local 3D view."""
import functools
import os
from pathlib import Path
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class BoardGameTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = os.environ.get("TEST_BOARD_URL", f"http://127.0.0.1:{cls.server.server_port}/board-game.html")
        cls.playwright = sync_playwright().start()
        executable = os.environ.get("TEST_CHROMIUM_PATH")
        if not executable and Path("/usr/bin/chromium").exists():
            executable = "/usr/bin/chromium"
        # The default exercises the supported CPU renderer. Set TEST_WEBGL=1
        # to exercise WebGL, including headless SwiftShader environments.
        args = ["--no-sandbox"]
        args += ["--enable-unsafe-swiftshader"] if os.environ.get("TEST_WEBGL") else ["--disable-webgl"]
        cls.browser = cls.playwright.chromium.launch(executable_path=executable, args=args)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={"width": 1440, "height": 1000}, reduced_motion="reduce"
        )
        # Core board rendering must work without any CDN or external images.
        self.context.route("https://**/*", lambda route: route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], "Unexpected JavaScript exception")

    def start_game(self, multiplayer=False):
        if multiplayer:
            self.page.locator("#addPlayer").click()
            self.page.get_by_label("Player 1", exact=True).fill("Avery")
            self.page.get_by_label("Player 2", exact=True).fill("Jordan")
        self.page.locator("#startGame").click()
        expect(self.page.locator("#tokenStart")).to_be_disabled()
        self.page.locator("[data-token-id]").nth(0).click()
        if multiplayer:
            expect(self.page.locator("[data-token-id]").nth(0)).to_be_disabled()
            self.page.locator("[data-token-id]").nth(1).click()
        self.page.locator("#tokenStart").click()
        expect(self.page.locator("#startingPinStart")).to_be_disabled()
        self.page.locator("[data-starting-pin-id]").nth(0).click()
        if multiplayer:
            expect(self.page.locator("[data-starting-pin-id]").nth(0)).to_be_disabled()
            self.page.locator("[data-starting-pin-id]").nth(1).click()
        self.page.evaluate("""async () => {
            const THREE = await import('./assets/vendor/three.module.js');
            const lookAt = THREE.PerspectiveCamera.prototype.lookAt;
            THREE.PerspectiveCamera.prototype.lookAt = function(point) {
                window.cameraSample = {x:point.x, y:point.y, z:point.z};
                if (window.tripSamples && !window.tripDone) window.tripSamples.push({...window.cameraSample});
                return lookAt.apply(this, arguments);
            };
        }""")
        self.page.locator("#startingPinStart").click()
        expect(self.page.locator("#board3dHost")).to_be_visible(timeout=30000)
        expect(self.page.locator(".board3d-stage canvas")).to_be_visible()
        self.page.wait_for_function("document.querySelector('#board3dInfo').textContent.includes('Space 1 / 80')")

    def test_setup_camera_and_collection_controls(self):
        self.start_game(multiplayer=True)
        self.assertEqual(self.page.evaluate("scrollY"), 0)
        expect(self.page.locator("#currentPlayerCenter .cash")).to_have_text("$1,000")
        expect(self.page.get_by_role("progressbar")).to_have_attribute("aria-valuenow", "0")
        next_space = self.page.get_by_role("button", name="Next board space", exact=True)
        next_space.focus()
        next_space.press("Enter")
        expect(self.page.locator("#board3dInfo")).to_contain_text("Main Street, U.S.A.")
        expect(next_space).to_be_focused()
        self.page.get_by_role("button", name="Previous board space", exact=True).click()
        expect(self.page.locator("#board3dInfo")).to_contain_text("Space 1 / 80")
        for control in ["Space names", "Night lights", "Live park"]:
            button = self.page.get_by_role("button", name=control, exact=True)
            before = button.get_attribute("aria-pressed")
            button.click()
            expect(button).to_have_attribute("aria-pressed", "false" if before == "true" else "true")
            button.click()
        self.page.locator('[data-camera="follow"]').click()
        expect(self.page.locator('[data-camera="follow"]')).to_have_attribute("aria-pressed", "true")
        self.page.locator('[data-camera="board"]').click()
        self.page.locator('[data-camera="flat"]').click()
        expect(self.page.locator("#board")).to_be_visible()
        expect(self.page.locator(".board3d-stage")).to_be_hidden()
        self.page.locator('[data-camera="flat"]').click()
        expect(self.page.locator(".board3d-stage")).to_be_visible()
        self.page.locator("#rulesBtn").click()
        expect(self.page.locator("#closeRules")).to_be_visible()
        self.page.locator("#closeRules").click()
        self.page.locator("[data-pin-player]").first.click()
        expect(self.page.locator("#pinBookClose")).to_be_visible()
        self.page.locator("#pinBookClose").click()

    def test_dice_movement_purchase_and_turn_handoff(self):
        self.start_game(multiplayer=True)
        for cube_id in ['dieCube','dieCube2']:
            for value in range(1,7):
                expect(self.page.locator(f'#{cube_id} .die-face[data-value="{value}"] .die-pip')).to_have_count(value)
        # Control only the dice and optional random encounter in this test.
        self.page.evaluate("rollTwoDice = () => [1, 2]")
        self.page.locator("#rollBtn").click()
        expect(self.page.locator("#rollBtn")).to_be_disabled()
        expect(self.page.locator("#propertyTryBuy")).to_be_visible(timeout=20000)
        expect(self.page.locator("#dice")).to_have_attribute("aria-label", "Roll two dice. Current faces 1 and 2. Total 3")
        expect(self.page.locator("#modalRoot")).to_contain_text("Haunted Mansion")
        self.page.locator("#propertyTryBuy").click()
        answer = self.page.evaluate("QUESTION_BANK.find(q => q.q === document.querySelector('.question').textContent).a")
        self.page.get_by_role("button", name=answer, exact=True).click()
        expect(self.page.locator("#currentPlayerCenter .cash")).to_have_text("$885")
        self.assertEqual(self.page.evaluate("owners[3]"), 0)
        self.assertEqual(self.page.evaluate("players[0].pos"), 3)
        self.page.evaluate("Math.random = () => 0.9")
        self.page.locator("#qActions button").click()
        self.page.locator("#endTurnDone").click()
        expect(self.page.locator("#turnText")).to_have_text("Jordan's turn")
        expect(self.page.locator("#rollBtn")).to_be_enabled()

    def test_earned_badge_updates_castle_quest(self):
        self.start_game()
        self.page.evaluate("players[0].pos = 79; renderAll(); rollTwoDice = () => [1, 2]")
        self.page.locator("#rollBtn").click()
        expect(self.page.locator(".question")).to_be_visible(timeout=20000)
        answer = self.page.evaluate("QUESTION_BANK.find(q => q.q === document.querySelector('.question').textContent).a")
        self.page.get_by_role("button", name=answer, exact=True).click()
        expect(self.page.get_by_role("progressbar")).to_have_attribute("aria-valuenow", "1")
        expect(self.page.locator(".quest-medal.earned")).to_have_count(1)
        expect(self.page.locator(".quest-medal.earned")).to_have_attribute("aria-label", "Magic Kingdom, earned")

    def test_free_roam_persists_and_camera_follows_movement(self):
        self.start_game()
        canvas = self.page.locator(".board3d-stage canvas")
        expect(self.page.locator('[data-camera="free"]')).to_have_attribute("aria-pressed", "true")
        self.page.wait_for_function("window.cameraSample !== undefined")
        before = self.page.evaluate("({...cameraSample})")
        canvas.focus()
        canvas.press("ArrowRight")
        self.page.wait_for_function("Math.abs(cameraSample.x) > 0.1")
        panned = self.page.evaluate("({...cameraSample})")
        self.assertGreater(abs(panned["x"] - before["x"]), 0.1)
        self.page.evaluate("renderAll()")
        self.page.wait_for_timeout(250)
        after = self.page.evaluate("({...cameraSample})")
        self.assertAlmostEqual(after["x"], panned["x"], places=3)
        self.assertAlmostEqual(after["z"], panned["z"], places=3)
        box = canvas.bounding_box()
        self.page.mouse.move(box["x"]+box["width"]*.5, box["y"]+box["height"]*.5)
        self.page.mouse.down()
        self.page.mouse.move(box["x"]+box["width"]*.6, box["y"]+box["height"]*.55, steps=5)
        self.page.mouse.up()
        self.page.wait_for_timeout(250)
        dragged = self.page.evaluate("({...cameraSample})")
        self.assertGreater(abs(dragged["x"] - after["x"])+abs(dragged["z"] - after["z"]), .2)
        canvas.press("+")
        self.assertGreater(int(self.page.locator('#board3dZoom').input_value()), 100)
        # Observe actual camera frames through an animated, multi-space move.
        self.page.emulate_media(reduced_motion="no-preference")
        self.page.locator('[data-ride-motion]').click()
        self.page.evaluate("() => { window.tripDone = false; window.tripSamples = []; window.trip = movePlayerSpaces(6); trip.then(() => window.tripDone = true); }")
        expect(self.page.locator('[data-camera="follow"]')).to_have_attribute("aria-pressed", "true")
        self.page.wait_for_function("tripDone", timeout=30000)
        samples = self.page.evaluate("tripSamples")
        self.assertGreater(len(samples), 1, "Camera must render frames during pawn movement")
        excursion = max(abs(s["x"]-samples[0]["x"])+abs(s["z"]-samples[0]["z"]) for s in samples)
        self.assertGreater(excursion, .2, "Camera must follow the pawn during its journey")
        expect(self.page.locator('[data-camera="free"]')).to_have_attribute("aria-pressed", "true")
        self.page.wait_for_function("""() => {
            const now = performance.now();
            const last = window.previousCameraSample;
            const sample = {...cameraSample, time:now};
            if (!last || now-last.time > 200) {
                window.previousCameraSample = sample;
                return last && Math.abs(sample.x-last.x)+Math.abs(sample.z-last.z) < .005;
            }
            return false;
        }""", timeout=15000)
        arrived = self.page.evaluate("({...cameraSample})")
        self.assertGreater(abs(arrived["x"])+abs(arrived["z"]), 5)
        self.page.evaluate("renderAll()")
        self.page.wait_for_timeout(250)
        retained = self.page.evaluate("({...cameraSample})")
        self.assertAlmostEqual(retained["x"], arrived["x"], delta=.05)
        self.assertAlmostEqual(retained["z"], arrived["z"], delta=.05)
        self.page.locator('[data-camera="board"]').click()
        self.page.wait_for_function("Math.abs(cameraSample.x) < .1 && Math.abs(cameraSample.z) < .1")

    def test_all_twelve_tokens_use_solid_3d_pawns(self):
        self.page.evaluate("""async () => {
            const THREE=await import('./assets/vendor/three.module.js');
            window.reviewThree=THREE;
            const add=THREE.Object3D.prototype.add;
            THREE.Object3D.prototype.add=function(...objects){
                if(this.isScene)window.pawnReviewScene=this;
                return add.apply(this,objects);
            };
        }""")
        self.start_game()
        seen=[]
        for start,count in [(0,8),(8,4)]:
            self.page.evaluate("""([start,count]) => {
                const template=JSON.parse(JSON.stringify(players[0]));
                players=TOKEN_OPTIONS.slice(start,start+count).map((token,i)=>({...JSON.parse(JSON.stringify(template)),name:token.name,token:token.id,startingPin:PIN_DESIGNS[i].id,pos:i+1}));
                currentPlayer=0;renderGame();
            }""", [start,count])
            self.page.wait_for_function("""count => {
                let found=0;pawnReviewScene.traverse(o=>{if(o.userData.tokenId)found++;});
                return found===count;
            }""",arg=count,timeout=30000)
            results=self.page.evaluate("""() => {
                const results=[];pawnReviewScene.traverse(pawn=>{
                    if(!pawn.userData.tokenId)return;
                    let meshes=0,billboards=0;pawn.traverse(o=>{if(o.isMesh){meshes++;if(o.geometry.type==='PlaneGeometry')billboards++;}});
                    results.push({id:pawn.userData.tokenId,meshes,billboards});
                });return results;
            }""")
            self.assertEqual(len(results),count)
            for pawn in results:
                self.assertGreaterEqual(pawn['meshes'],7,pawn['id'])
                self.assertEqual(pawn['billboards'],0,pawn['id'])
                seen.append(pawn['id'])
        self.assertEqual(len(set(seen)),12)

    def test_complete_board_scenes_fit_the_original_spaces(self):
        self.page.evaluate("""async () => {
            const THREE = await import('./assets/vendor/three.module.js');
            window.reviewThree = THREE;
            const add = THREE.Object3D.prototype.add;
            THREE.Object3D.prototype.add = function(...objects) {
                if (this.isScene) window.reviewScene = this;
                return add.apply(this, objects);
            };
        }""")
        self.start_game()
        result = self.page.evaluate("""() => {
            const roots=[]; reviewScene.traverse(o => {if(o.userData.boardSpace!==undefined) roots.push(o);});
            const generic=['building','tree','mountain','boat','station','show','coaster'];
            const remaining=['friendship','fantasmic','resistance','starTours','indiana','derby','safari','everest','naviRiver','banshee','awakenings','rapids','lionKing','birds','gorillas','nemoShow'];
            window.remainingSceneBounds = () => {
                reviewScene.updateMatrixWorld(true);
                return roots.filter(r => remaining.includes(r.userData.shape)).map(root => {
                    const inverse=root.matrixWorld.clone().invert(), bounds=new reviewThree.Box3();
                    root.traverse(part => {
                        if (!part.isMesh) return;
                        const matrix=inverse.clone().multiply(part.matrixWorld), positions=part.geometry.attributes.position;
                        for(let i=0;i<positions.count;i++) bounds.expandByPoint(new reviewThree.Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix));
                    });
                    const width=root.userData.shape==='friendship'?1.12:.47501;
                    return {name:root.name, fits:bounds.min.x>=-width && bounds.max.x<=width && bounds.min.z>=-1.11 && bounds.max.z<=1.11,
                            x:[bounds.min.x,bounds.max.x],z:[bounds.min.z,bounds.max.z]};
                });
            };
            return {count:roots.length,generic:roots.filter(r=>generic.includes(r.userData.shape)).map(r=>r.name),bounds:remainingSceneBounds()};
        }""")
        self.assertEqual(result['count'], 80)
        self.assertEqual(result['generic'], [], 'Every space should use a dedicated scene')
        self.assertEqual(len(result['bounds']), 16)
        self.assertEqual([b for b in result['bounds'] if not b['fits']], [], 'Scene extends beyond its existing tile')

    def test_phone_layout_and_classic_fallback(self):
        self.context.close()
        self.context = self.browser.new_context(viewport={"width":390,"height":844}, has_touch=True, reduced_motion="reduce")
        self.context.route("https://**/*", lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.assertFalse(self.page.evaluate("document.documentElement.scrollWidth > innerWidth"))
        self.start_game()
        canvas = self.page.locator(".board3d-stage canvas")
        canvas.scroll_into_view_if_needed()
        bounds = canvas.bounding_box()
        x, y = bounds["x"] + bounds["width"] / 2, bounds["y"] + bounds["height"] / 2
        cdp = self.context.new_cdp_session(self.page)
        cdp.send("Input.dispatchTouchEvent", {"type":"touchStart", "touchPoints":[{"x":x-30,"y":y,"id":1},{"x":x+30,"y":y,"id":2}]})
        cdp.send("Input.dispatchTouchEvent", {"type":"touchMove", "touchPoints":[{"x":x-50,"y":y+10,"id":1},{"x":x+70,"y":y+10,"id":2}]})
        cdp.send("Input.dispatchTouchEvent", {"type":"touchEnd", "touchPoints":[]})
        self.page.wait_for_function("Number(document.querySelector('#board3dZoom').value) > 100")
        expect(self.page.locator('[data-camera="free"]')).to_have_attribute("aria-pressed", "true")
        self.assertFalse(self.page.evaluate("document.documentElement.scrollWidth > innerWidth"))
        self.page.locator("#rollBtn").scroll_into_view_if_needed()
        expect(self.page.locator("#rollBtn")).to_be_visible()
        self.page.locator('[data-camera="flat"]').click()
        self.assertFalse(self.page.evaluate("document.documentElement.scrollWidth > innerWidth"))
        expect(self.page.locator(".board-wrap")).to_be_visible()
        self.page.locator('[data-camera="flat"]').click()
        expect(self.page.locator(".board3d-stage")).to_be_visible()


if __name__ == "__main__":
    unittest.main()
