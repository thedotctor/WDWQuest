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

    def start_five_player_game(self):
        for _ in range(4):
            self.page.locator('#addPlayer').click()
        for i,name in enumerate(['Avery','Blake','Casey','Drew','Emery']):
            self.page.get_by_label(f'Player {i+1}',exact=True).fill(name)
        self.page.locator('#startGame').click()
        for token in ['castle','monorail','epcot','tree','rocket']:
            self.page.locator(f'[data-token-id="{token}"]').click()
        self.page.locator('#tokenStart').click()
        for pin in ['mk-castle','ep-figment','hs-movie','ak-tree','food-popcorn']:
            self.page.locator(f'[data-starting-pin-id="{pin}"]').click()
        self.page.locator('#startingPinStart').click()
        expect(self.page.locator('#board3dHost')).to_be_visible(timeout=30000)
        self.assertEqual(self.page.evaluate('players.length'),5)

    def test_eight_property_goal_is_universal_and_keeps_other_requirements(self):
        expect(self.page.locator('#gameMode')).to_have_count(0)
        self.start_game()
        self.page.evaluate("""() => {
            const indices=SPACES.map((s,i)=>s.type==='property'&&s.park==='Magic Kingdom'&&!s.show?i:-1).filter(i=>i>=0).slice(0,8);
            players[0].badges=BADGES.slice();players[0].pins=PIN_DESIGNS.filter(pin=>pin.park==='Magic Kingdom').map(pin=>pin.id);
            owners={};indices.slice(0,7).forEach(i=>owners[i]=0);players[0].props=indices.slice(0,7);window.eighthProperty=indices[7];renderAll();
        }""")
        self.assertFalse(self.page.evaluate('finaleProgress(0).ready'))
        self.page.evaluate('owners[eighthProperty]=0;players[0].props.push(eighthProperty);renderAll()')
        self.assertTrue(self.page.evaluate('finaleProgress(0).ready'))
        self.assertEqual(self.page.evaluate('finaleProgress(0).qualifyingPark.propertiesTotal'),8)
        expect(self.page.locator('#castleFinaleBtn')).to_be_enabled()
        self.page.evaluate('players[0].pins.pop();renderAll()')
        expect(self.page.locator('#castleFinaleBtn')).to_be_disabled()
        self.page.evaluate("players[0].pins.push('mk-mouse');players[0].badges.pop();renderAll()")
        self.assertFalse(self.page.evaluate('finaleProgress(0).ready'))
        self.page.evaluate('players[0].badges=BADGES.slice();players[0].finaleLapRemaining=1;renderAll()')
        self.assertFalse(self.page.evaluate('finaleProgress(0).ready'))
        self.page.evaluate("""() => {
            owners={};SPACES.forEach((space,index)=>{if(space.type==='property'&&(space.park==='Magic Kingdom'||space.park==='EPCOT'&&index<=33))owners[index]=0;});
            players[0].props=ownedPropertyIndices(0);players[0].pins=PIN_DESIGNS.filter(pin=>pin.park==='Magic Kingdom').slice(0,3).concat(PIN_DESIGNS.filter(pin=>pin.park==='EPCOT').slice(0,4)).map(pin=>pin.id);
        }""")
        self.assertEqual(self.page.evaluate('finaleProgress(0).bestPark.park'),'EPCOT')

    def test_pixie_dust_targets_missing_badges_and_keeps_park_trivia(self):
        self.start_game()
        result=self.page.evaluate("""() => {
            players[0].badges=BADGES.filter(b=>!['Disney History','Resorts & Dining'].includes(b));
            const categories=[];for(let i=0;i<12;i++){askQuestion(null,{mode:'special',space:6});categories.push(document.querySelector('.modal .badge').textContent);}
            players[0].badges=BADGES.filter(b=>b!=='Disney History');askQuestion(null,{mode:'special',space:6});
            const onlyMissing=document.querySelector('.modal .badge').textContent;
            askQuestion('Disney History',{mode:'property',space:3});const purchase=document.querySelector('.modal .badge').textContent;
            askQuestion('Disney History',{mode:'badge',space:22});const parkTrivia=document.querySelector('.modal .badge').textContent;
            players[0].badges=BADGES.slice();askQuestion(null,{mode:'special',space:6});const afterComplete=document.querySelector('.modal .badge').textContent;
            return {categories,onlyMissing,purchase,parkTrivia,afterComplete};
        }""")
        self.assertTrue(all(category in ['Disney History','Resorts & Dining'] for category in result['categories']))
        self.assertEqual(result['onlyMissing'],'Disney History')
        self.assertEqual(result['purchase'],'Magic Kingdom')
        self.assertEqual(result['parkTrivia'],'EPCOT')
        self.assertIn(result['afterComplete'],self.page.evaluate('BADGES'))

    def prepare_cash_offer(self):
        self.page.evaluate("""() => {
            players[0].cash=500;players[0].props=[];players[1].cash=400;players[1].props=[3];owners={3:1};finishTurn('Ready for a park partner deal.');
        }""")
        expect(self.page.locator('#endTurnTrade')).to_be_disabled()
        self.page.locator('#endTurnBuy').click()
        self.page.locator('[data-property-partner="1"]').click()
        self.page.locator('[data-cash-property="3"]').click()

    def test_cash_property_offer_requires_acceptance_and_transfers_once(self):
        self.start_five_player_game();self.prepare_cash_offer()
        self.page.locator('#propertyCashAmount').fill('125')
        self.page.locator('#propertyCashMakeOffer').click()
        self.assertEqual(self.page.evaluate('owners[3]'),1)
        self.assertEqual(self.page.evaluate('players.slice(0,2).map(p=>p.cash)'),[500,400])
        self.page.evaluate("window.acceptCashButton=document.getElementById('propertyCashAccept')")
        self.page.locator('#propertyCashAccept').click()
        self.page.evaluate('acceptCashButton.click()')
        self.assertEqual(self.page.evaluate('owners[3]'),0)
        self.assertEqual(self.page.evaluate('players.slice(0,2).map(p=>p.cash)'),[375,525])
        self.assertEqual(self.page.evaluate('players[0].props'),[3])
        self.assertEqual(self.page.evaluate('players[1].props'),[])
        self.assertFalse(self.page.evaluate('executePropertyCashOffer(propertyTradeTurn,3,125)'))
        self.page.locator('#propertyTradeNext').click()
        self.assertEqual(self.page.evaluate('currentPlayer'),1)
        expect(self.page.locator('#rollBtn')).to_be_enabled()

    def test_cash_offers_reject_invalid_amounts_and_stale_balances(self):
        self.start_five_player_game();self.prepare_cash_offer()
        for amount in ['0','-1','1.5','501','']:
            self.page.locator('#propertyCashAmount').fill(amount)
            expect(self.page.locator('#propertyCashMakeOffer')).to_be_disabled()
        self.page.locator('#propertyCashAmount').fill('100')
        self.page.locator('#propertyCashMakeOffer').click()
        self.page.evaluate('players[0].cash=50')
        self.page.locator('#propertyCashAccept').click()
        self.assertEqual(self.page.evaluate('owners[3]'),1)
        self.assertEqual(self.page.evaluate('players.slice(0,2).map(p=>p.cash)'),[50,400])
        expect(self.page.get_by_role('heading',name='Offer Unavailable')).to_be_visible()
        self.page.locator('#propertyTradeNext').click()
        self.page.evaluate('currentPlayer=0;turnLocked=false')
        self.prepare_cash_offer()
        self.page.locator('#propertyCashAmount').fill('100')
        self.page.locator('#propertyCashMakeOffer').click()
        self.page.locator('#propertyCashDecline').click()
        self.assertEqual(self.page.evaluate('owners[3]'),1)
        self.assertEqual(self.page.evaluate('players.slice(0,2).map(p=>p.cash)'),[500,400])

    def test_pin_trader_purchase_allows_park_copies_and_one_trade(self):
        self.start_five_player_game()
        self.page.evaluate("""() => {
            players[0].cash=200;players[0].pos=5;players[0].pins=['mk-castle'];players[1].pins=['ep-figment','mk-teacup'];players[2].pins.push('resort-contemporary');startPinTradersVisit(5);window.originalPinVisit=pinTradeVisit;
        }""")
        self.page.locator('#pinTraderShop').click()
        expect(self.page.locator('[data-trader-buy-pin="mk-castle"]')).to_have_count(0)
        expect(self.page.locator('[data-trader-buy-pin="resort-contemporary"]')).to_have_count(0)
        self.page.locator('[data-trader-buy-pin="mk-teacup"]').click()
        self.assertEqual(self.page.evaluate('players[0].cash'),100)
        self.assertTrue(self.page.evaluate("players[0].pins.includes('mk-teacup')&&players[1].pins.includes('mk-teacup')"))
        self.assertFalse(self.page.evaluate("buyTraderPin(originalPinVisit,'mk-mouse')"))
        self.assertEqual(self.page.evaluate('players[0].pinTradesThisTurn'),0)
        self.page.locator('#pinShopContinue').click()
        expect(self.page.locator('#pinTraderShop')).to_be_disabled()
        self.page.locator('[data-pin-partner="1"]').click()
        self.page.locator('[data-pin-give="mk-castle"]').click()
        self.page.locator('[data-pin-take="ep-figment"]').click()
        self.page.locator('#pinOffer').click();self.page.locator('#pinTradeAccept').click()
        self.page.wait_for_function('players[0].pinTradesThisTurn===1')
        self.assertEqual(self.page.evaluate('players[0].cash'),100)
        self.assertEqual(self.page.evaluate('players[0].pins'),['ep-figment','mk-teacup'])
        self.page.locator('#pinTradeClose').click()
        self.assertFalse(self.page.evaluate("buyTraderPin(originalPinVisit,'mk-mouse')"))

    def test_pin_trader_shop_blocks_unaffordable_purchases(self):
        self.start_game()
        self.page.evaluate('players[0].cash=99;players[0].pos=5;startPinTradersVisit(5);showPinTraderShop()')
        expect(self.page.locator('[data-trader-buy-pin]:enabled')).to_have_count(0)
        self.assertFalse(self.page.evaluate("buyTraderPin(pinTradeVisit,'mk-mouse')"))
        self.assertEqual(self.page.evaluate('players[0].cash'),99)

    def test_park_hopper_bonus_credits_full_lap_and_resumes_landing(self):
        self.start_game()
        self.page.evaluate("""() => {
            players[0].pos=79;players[0].parkHopperSteps=79;players[0].parkHopperLaps=0;players[0].cash=50;
            turnLocked=true;renderAll();window.lapJourney=movePlayerSpaces(2).then(()=>resolveSpace(players[0].pos,false));
        }""")
        popup=self.page.locator('.park-hopper-modal')
        expect(popup).to_be_visible()
        expect(popup.locator('h2')).to_have_text("Four Parks, One Day! Here's A MAGIC for your next trip.")
        self.assertEqual(self.page.evaluate('players[0].cash'),350)
        self.assertEqual(self.page.evaluate('players[0].pos'),1)
        expect(self.page.locator('#rollBtn')).to_be_disabled()
        self.assertEqual(self.page.evaluate('currentPlayer'),0)
        self.page.locator('#parkHopperContinue').click()
        expect(self.page.locator('#propertyTryBuy')).to_be_visible(timeout=10000)
        self.assertEqual(self.page.evaluate('players[0].parkHopperLaps'),1)
        self.assertEqual(self.page.evaluate('players[0].cash'),350)

    def test_park_hopper_bonus_cannot_be_farmed_by_backtracking(self):
        self.start_game()
        self.page.evaluate("""async () => {
            const p=players[0];p.pos=0;p.parkHopperSteps=80;p.parkHopperLaps=1;turnLocked=true;
            window.cashBeforeBacktrack=p.cash;
            await movePlayerSpaces(-1);await movePlayerSpaces(1);
        }""")
        self.assertEqual(self.page.evaluate('players[0].cash'),self.page.evaluate('cashBeforeBacktrack'))
        expect(self.page.locator('.park-hopper-modal')).to_have_count(0)
        self.assertEqual(self.page.evaluate('players[0].parkHopperSteps'),80)
        self.page.evaluate("""() => {
            players[0].pos=79;players[0].parkHopperSteps=159;
            window.secondLap=movePlayerSpaces(1);
        }""")
        expect(self.page.locator('.park-hopper-modal')).to_be_visible()
        self.assertEqual(self.page.evaluate('players[0].cash'),self.page.evaluate('cashBeforeBacktrack')+300)
        self.page.locator('#parkHopperContinue').click()
        self.page.evaluate('() => window.secondLap')
        self.assertEqual(self.page.evaluate('players[0].parkHopperLaps'),2)

    def test_park_hopper_bonus_tracks_each_player_and_ignores_security(self):
        self.start_five_player_game()
        self.page.evaluate("""() => {
            players.forEach(p=>{p.pos=79;p.parkHopperSteps=79;p.parkHopperLaps=0;});
            turnLocked=true;window.playerOneLap=movePlayerSpaces(1,'bonus travel');
        }""")
        expect(self.page.locator('.park-hopper-modal')).to_be_visible()
        self.assertEqual(self.page.evaluate('players.map(p=>p.cash)'),[1300,1000,1000,1000,1000])
        self.page.locator('#parkHopperContinue').click()
        self.page.evaluate("""() => {
            currentPlayer=1;window.playerTwoLap=movePlayerSpaces(1,'Magic & Mischief');
        }""")
        expect(self.page.locator('.park-hopper-modal')).to_be_visible()
        self.assertEqual(self.page.evaluate('players.map(p=>p.cash)'),[1300,1300,1000,1000,1000])
        self.page.locator('#parkHopperContinue').click()
        self.page.evaluate("""() => {
            currentPlayer=2;applyMagicCard(MAGIC_CARDS.find(card=>card.effect==='security'));
        }""")
        self.page.wait_for_function('players[2].inSecurity',timeout=15000)
        self.assertEqual(self.page.evaluate('players[2].parkHopperSteps'),79)
        self.assertEqual(self.page.evaluate('players[2].cash'),1000)
        expect(self.page.locator('.park-hopper-modal')).to_have_count(0)

    def test_snack_photo_callbacks_ignore_closed_and_replaced_popups(self):
        self.start_game()
        result=self.page.evaluate("""() => {
            const issues=[];
            askSnackBreak(12);
            const oldPhoto=document.getElementById('snackPhoto'),oldError=oldPhoto.onerror,oldLoad=oldPhoto.onload;
            closeModal();
            try{oldError();oldError();oldLoad();}catch(error){issues.push(error.message);}
            if(modalRoot.children.length)issues.push('Closed popup was restored');
            askSnackBreak(31);
            const newPhoto=document.getElementById('snackPhoto');
            try{oldError();oldLoad();}catch(error){issues.push(error.message);}
            if(document.getElementById('snackPhoto')!==newPhoto)issues.push('Old photo replaced the next question');
            // Failure for the current photo still shows the normal load-error state.
            try{newPhoto.onerror();newPhoto.onerror();}catch(error){issues.push(error.message);}
            if(!document.querySelector('#snackPicture .snack-load-error'))issues.push('Current photo error is missing');
            closeModal();return issues;
        }""")
        self.assertEqual(result,[])

    def test_five_player_card_payments_cannot_create_debt(self):
        # Focused balances reproduce late-game cases from the complete playthrough.
        self.start_five_player_game()
        cases=self.page.evaluate("""() => {
            const check=(cash,card)=>{players.forEach((p,i)=>p.cash=cash[i]);const before=players.reduce((sum,p)=>sum+p.cash,0);const message=applyMagicInstantEffect(card,0);return {cash:players.map(p=>p.cash),before,after:players.reduce((sum,p)=>sum+p.cash,0),message};};
            return {
                expense:check([10,10,10,10,10],{effect:'cash',amount:-100}),
                maintenance:check([5,10,10,10,10],{effect:'maintenance'}),
                collect:check([10,10,10,10,10],{effect:'collectPlayers'}),
                share:check([10,10,10,10,10],{effect:'payPlayers'}),
                gift:check([10,10,10,10,10],{effect:'richestGift'}),
                fullShare:check([100,10,10,10,10],{effect:'payPlayers'})
            };
        }""")
        self.assertEqual(cases['expense']['cash'],[0,10,10,10,10])
        self.assertIn('$10',cases['expense']['message'])
        self.assertEqual(cases['maintenance']['cash'][0],0)
        self.assertEqual(cases['collect']['cash'],[50,0,0,0,0])
        self.assertIn('$40',cases['collect']['message'])
        self.assertEqual(cases['share']['cash'][0],0)
        self.assertLessEqual(max(cases['share']['cash'][1:])-min(cases['share']['cash'][1:]),1)
        self.assertEqual(cases['gift']['cash'],[20,0,10,10,10])
        self.assertEqual(cases['fullShare']['cash'],[0,35,35,35,35])
        for key in ['collect','share','gift','fullShare']:
            self.assertEqual(cases[key]['before'],cases[key]['after'],key)
        for case in cases.values():
            self.assertTrue(all(cash>=0 for cash in case['cash']))
        self.assertFalse(self.page.evaluate('players[0].eliminated'))

    def test_elimination_returns_pins_without_resetting_power_uses(self):
        self.start_five_player_game()
        self.page.evaluate("""() => {
            players[0].cash=20;players[0].pos=3;players[0].props=[7];players[0].pins=['mk-castle','food-icecream','resort-contemporary'];
            players[1].props=[3];owners={3:1,7:0};pinPowerUses['resort-contemporary']='used';
            window.ownerCashBefore=players[1].cash;showRentPayment(3);
        }""")
        self.page.locator('#rentBroke').click()
        self.page.wait_for_function('currentPlayer===1&&!turnLocked',timeout=15000)
        result=self.page.evaluate("""() => ({
            loser:players[0],ownerCash:players[1].cash,previous:ownerCashBefore,owners,
            available:unownedPins().map(pin=>pin.id),used:pinPowerUses['resort-contemporary']
        })""")
        self.assertTrue(result['loser']['eliminated'])
        self.assertEqual(result['loser']['cash'],0)
        self.assertEqual(result['loser']['props'],[])
        self.assertEqual(result['loser']['pins'],[])
        self.assertEqual(result['loser']['startingPin'],'mk-castle')
        self.assertNotIn('7',result['owners'])
        self.assertEqual(result['ownerCash'],result['previous']+20)
        for pin in ['mk-castle','food-icecream','resort-contemporary']:
            self.assertIn(pin,result['available'])
        self.assertEqual(result['used'],'used')
        # The returned pin can be bought by another player, with its use history intact.
        self.page.evaluate('() => {window.returnedPinPurchase=offerDoublesPinPurchase(1)}')
        self.page.locator('[data-buy-pin="resort-contemporary"]').click()
        self.assertTrue(self.page.evaluate("players[1].pins.includes('resort-contemporary')"))
        self.assertFalse(self.page.evaluate("powerReady(players[1],'resort-contemporary')"))

    def test_dice_have_visible_pips_on_all_six_faces(self):
        self.page.evaluate("""async () => {
            const THREE=await import('./assets/vendor/three.module.js');window.diceReviewThree=THREE;
            const add=THREE.Object3D.prototype.add;
            THREE.Object3D.prototype.add=function(...objects){if(this.isScene)window.diceReviewScene=this;return add.apply(this,objects);};
        }""")
        self.start_game()
        result=self.page.evaluate("""() => {
            const issues=[];
            for(let i=1;i<=2;i++){
                const die=diceReviewScene.getObjectByName('Game die '+i);
                if(!die){issues.push('Missing die '+i);continue;}
                const cube=die.children.find(o=>o.isMesh);
                if(!Array.isArray(cube.material)||cube.material.length!==6){issues.push('Missing painted faces');continue;}
                const groups=cube.geometry.groups;
                if(groups.length!==6||new Set(groups.map(g=>g.materialIndex)).size!==6)issues.push('Face material mapping incomplete');
                cube.material.forEach(mat=>{
                    const image=mat.map&&mat.map.image;
                    if(!image){issues.push('Missing face texture');return;}
                    const w=image.width,h=image.height,data=image.getContext('2d').getImageData(0,0,w,h).data,visited=new Uint8Array(w*h);
                    const dark=index=>data[index*4]<80&&data[index*4+1]<80&&data[index*4+2]<80;
                    let dots=0;
                    for(let index=0;index<w*h;index++){
                        if(visited[index]||!dark(index))continue;dots++;const stack=[index];visited[index]=1;
                        while(stack.length){const pixel=stack.pop(),x=pixel%w,y=Math.floor(pixel/w);
                            for(const next of [x>0?pixel-1:-1,x<w-1?pixel+1:-1,y>0?pixel-w:-1,y<h-1?pixel+w:-1]){
                                if(next>=0&&!visited[next]&&dark(next)){visited[next]=1;stack.push(next);}
                            }
                        }
                    }
                    if(dots!==mat.userData.dieValue)issues.push('Wrong painted dot count '+mat.userData.dieValue+': '+dots);
                });
                const values=cube.material.map(mat=>mat.userData.dieValue);
                if(new Set(values).size!==6||values[0]+values[1]!==7||values[2]+values[3]!==7||values[4]+values[5]!==7)issues.push('Incorrect opposite faces');
            }
            return issues;
        }""")
        self.assertEqual(result,[])

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
