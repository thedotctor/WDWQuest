"""Multi-browser room UI integration. Default: local shared transport.

TEST_FIREBASE_EMULATOR=1 uses the real bundled SDK and official emulators instead.
The default transport does not validate Firebase's database security rules.
"""
import functools
import json
import os
from pathlib import Path
import subprocess
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
CONFIG = """window.WDW_FIREBASE_CONFIG={apiKey:'demo-key',projectId:'demo-wdwquest',
authDomain:'demo-wdwquest.firebaseapp.com',appId:'demo-app',
databaseURL:'https://demo-wdwquest.firebaseio.com'};
window.WDW_FIREBASE_EMULATORS={auth:9099,database:9000};"""


class PhoneRoomTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.transport = None
        if not os.environ.get('TEST_FIREBASE_EMULATOR'):
            cls.transport = subprocess.Popen(['node', str(ROOT/'tests/fixtures/room-transport.cjs')], stdout=subprocess.PIPE, text=True)
            assert 'ready' in cls.transport.stdout.readline()
        class QuietHandler(SimpleHTTPRequestHandler):
            def log_message(self, *_): pass
        handler = functools.partial(QuietHandler, directory=str(ROOT))
        cls.server = ThreadingHTTPServer(('127.0.0.1',0),handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close();cls.thread.join()
        if cls.transport:cls.transport.terminate();cls.transport.wait();cls.transport.stdout.close()

    def setUp(self):
        self.contexts=[];self.errors=[]
        self.host=self.page(phone=False)
        self.host.goto(self.url+'/board-game.html')
        self.host.locator('#hostPhones').click()
        expect(self.host.locator('#hostRoomCode')).to_be_visible()
        self.code=self.host.locator('#hostRoomCode').inner_text()

    def tearDown(self):
        for context in self.contexts:context.close()
        self.assertEqual(self.errors,[])

    def page(self,phone=True):
        context=self.browser.new_context(viewport={'width':390 if phone else 1440,'height':844 if phone else 1000},reduced_motion='reduce')
        context.route('https://**/*',lambda route:route.abort())
        context.route('**/assets/firebase/config.js',lambda route:route.fulfill(body=CONFIG,content_type='application/javascript'))
        if not os.environ.get('TEST_FIREBASE_EMULATOR'):
            context.route('**/assets/vendor/firebase-room-sdk.js',lambda route:route.fulfill(path=str(ROOT/'tests/fixtures/room-sdk.js'),content_type='application/javascript'))
        page=context.new_page();page.on('pageerror',lambda e:self.errors.append(str(e)));self.contexts.append(context);return page

    def join(self,name,token,pin):
        page=self.page();page.goto(self.url+f'/board-controller.html?room={self.code}')
        page.locator('#joinName').fill(name);page.locator('#joinRoom').click()
        expect(page.get_by_role('heading',name=f'Welcome, {name}.')).to_be_visible()
        page.locator(f'[data-choose-token="{token}"]').click()
        expect(page.locator(f'[data-choose-token="{token}"]')).to_have_attribute('aria-pressed','true')
        page.locator(f'[data-choose-pin="{pin}"]').click()
        expect(page.locator(f'[data-choose-pin="{pin}"]')).to_have_attribute('aria-pressed','true')
        return page

    def start(self):
        self.a=self.join('Avery','castle','mk-castle');self.b=self.join('Blake','monorail','ep-figment')
        expect(self.host.locator('#startPhoneGame')).to_be_enabled()
        self.host.locator('#startPhoneGame').click()
        expect(self.host.locator('#board3dHost')).to_be_visible(timeout=30000)
        self.host.evaluate('wait=()=>Promise.resolve()')
        expect(self.a.get_by_role('button',name='Roll Dice',exact=True)).to_be_enabled()
        expect(self.b.get_by_role('heading',name='Watch the shared screen.')).to_be_visible()

    def test_lobby_and_phone_roll_turn_handoff_and_refresh(self):
        self.start()
        # A deterministic roll of 2 reaches MK trivia through the real roll handler.
        self.host.evaluate('Math.random=()=>0;window.roomQuestion=null;const pick=pickQuestion;pickQuestion=function(...args){const q=pick(...args);window.roomQuestion=q;return q}')
        self.a.get_by_role('button',name='Roll Dice',exact=True).click()
        self.a.get_by_role('button',name='No / Continue Moving',exact=True).click()
        expect(self.host.locator('#qAnswers')).to_be_visible()
        self.host.wait_for_function('window.roomQuestion !== null')
        answer=self.host.evaluate('window.roomQuestion.a')
        self.a.get_by_role('button',name=answer,exact=True).click()
        self.host.wait_for_function("players[0].badges.includes('Magic Kingdom')")
        # Correct answers may trigger an autograph surprise; advance ordinary buttons.
        for _ in range(6):
            if self.host.evaluate('currentPlayer===1'):break
            candidates=self.a.locator('[data-room-action]:enabled')
            candidates.first.wait_for(state='visible')
            candidates.first.click();self.a.wait_for_timeout(250)
        self.host.wait_for_function('currentPlayer===1')
        expect(self.b.get_by_role('button',name='Roll Dice',exact=True)).to_be_enabled()
        self.b.reload()
        expect(self.b.get_by_role('button',name='Roll Dice',exact=True)).to_be_enabled()
        self.assertEqual(self.host.evaluate('players.length'),2)
        self.assertEqual(self.host.evaluate('players[0].badges'),['Magic Kingdom'])

    def test_cash_trade_acceptance_moves_to_seller_phone(self):
        self.start()
        self.host.evaluate("owners={1:0,21:1};players[0].props=[1];players[1].props=[21];renderAll();finishTurn('Room trade test')")
        self.a.get_by_role('button',name='Offer Cash for a Property',exact=True).click()
        self.a.get_by_role('button',name='Blake (1 properties)',exact=True).click()
        self.a.locator('[data-room-action]').filter(has_text='Spaceship Earth').click()
        amount=self.a.locator('input[type=number]');amount.fill('125')
        self.a.get_by_role('button',name='Update Amount',exact=True).click()
        self.a.get_by_role('button',name='Make Cash Offer',exact=True).click()
        expect(self.b.get_by_role('button',name='Accept $125',exact=True)).to_be_enabled()
        self.assertEqual(self.a.get_by_role('button',name='Accept $125',exact=True).count(),0)
        self.b.get_by_role('button',name='Accept $125',exact=True).click()
        self.host.wait_for_function('owners[21]===0 && players[0].cash===875 && players[1].cash===1125')
        self.a.get_by_role('button',name='Next Player',exact=True).click()
        expect(self.b.get_by_role('button',name='Roll Dice',exact=True)).to_be_enabled()

    def test_wrong_player_and_stale_commands_cannot_roll(self):
        self.start()
        result=self.b.evaluate("""async code=>{
          const c=await import('./assets/firebase/client.js');const {db,uid}=await c.connect();
          const state=(await c.get(c.ref(db,`rooms/${code}/state`))).val();
          const match=state.prompt.match(/data-room-action=\"(c[0-9]+)\"/);
          try{await c.set(c.ref(db,`rooms/${code}/commands/${uid}`),{id:crypto.randomUUID(),action:match[1],revision:state.revision,sentAt:c.serverTimestamp()});return 'sent';}catch(e){return 'denied';}
        }""",self.code)
        if os.environ.get('TEST_FIREBASE_EMULATOR'):self.assertEqual(result,'denied')
        self.host.wait_for_timeout(300)
        self.assertEqual(self.host.evaluate('players[0].pos'),0)
        self.a.evaluate("""async code=>{
          const c=await import('./assets/firebase/client.js');const {db,uid}=await c.connect();
          const state=(await c.get(c.ref(db,`rooms/${code}/state`))).val();
          const match=state.prompt.match(/data-room-action=\"(c[0-9]+)\"/);
          try{await c.set(c.ref(db,`rooms/${code}/commands/${uid}`),{id:crypto.randomUUID(),action:match[1],revision:state.revision-1,sentAt:c.serverTimestamp()});}catch(e){}
        }""",self.code)
        self.host.wait_for_timeout(300)
        self.assertEqual(self.host.evaluate('players[0].pos'),0)

    def test_room_close_keeps_board_available_for_local_play(self):
        self.start();self.host.on('dialog',lambda dialog:dialog.accept())
        self.host.locator('#endPhoneRoom').click()
        expect(self.a.locator('#joinRoom')).to_be_visible()
        expect(self.host.locator('#rollBtn')).to_be_enabled()
        self.assertEqual(self.host.evaluate('players.length'),2)

    def test_remote_prompt_sanitization_removes_executable_roots_and_attributes(self):
        result=self.host.evaluate("""async()=>{
          const {safePrompt}=await import('./assets/firebase/client.js');
          const template=document.createElement('template');
          template.innerHTML='<script>window.badPrompt=true</script><iframe srcdoc=\"bad\"></iframe><button onclick=\"window.badPrompt=true\">Safe</button><input type=file><img src=\"javascript:bad\" onerror=\"window.badPrompt=true\">';
          const wrapper=document.createElement('div');for(const node of template.content.children) wrapper.append(safePrompt(node));
          document.body.append(wrapper);
          return {executed:!!window.badPrompt,scripts:wrapper.querySelectorAll('script,iframe,input[type=file]').length,unsafe:wrapper.querySelectorAll('[onclick],[onerror],img[src]').length,text:wrapper.textContent};
        }""")
        self.assertFalse(result['executed']);self.assertEqual(result['scripts'],0);self.assertEqual(result['unsafe'],0);self.assertIn('Safe',result['text'])

    def test_host_presence_pauses_and_restores_phone_choices(self):
        self.start()
        change="""async([code,online])=>{const c=await import('./assets/firebase/client.js');const {db,uid}=await c.connect();await c.set(c.ref(db,`rooms/${code}/presence/${uid}`),{online,at:c.serverTimestamp()});}"""
        self.host.evaluate(change,[self.code,False])
        expect(self.a.get_by_role('button',name='Roll Dice',exact=True)).to_be_disabled()
        expect(self.a.locator('#controllerConnection')).to_contain_text('shared screen to reconnect')
        self.host.evaluate(change,[self.code,True])
        expect(self.a.get_by_role('button',name='Roll Dice',exact=True)).to_be_enabled()

    def test_five_phone_players_complete_a_round(self):
        roster=[('Avery','castle','mk-castle'),('Blake','monorail','ep-figment'),('Casey','epcot','hs-movie'),('Drew','tree','ak-tree'),('Emery','rocket','food-popcorn')]
        phones=[self.join(*player) for player in roster]
        self.host.locator('#startPhoneGame').click()
        expect(self.host.locator('#board3dHost')).to_be_visible(timeout=30000)
        self.host.evaluate('wait=()=>Promise.resolve();Math.random=()=>0;window.roomQuestion=null;const pick=pickQuestion;pickQuestion=function(...args){const q=pick(...args);window.roomQuestion=q;return q}')
        for i,phone in enumerate(phones):
            expect(phone.get_by_role('button',name='Roll Dice',exact=True)).to_be_enabled()
            self.assertTrue(all(other.get_by_role('button',name='Roll Dice',exact=True).count()==0 for j,other in enumerate(phones) if j!=i))
            phone.get_by_role('button',name='Roll Dice',exact=True).click()
            phone.get_by_role('button',name='No / Continue Moving',exact=True).click()
            expect(self.host.locator('#qAnswers')).to_be_visible()
            answer=self.host.evaluate('window.roomQuestion.a')
            phone.get_by_role('button',name=answer,exact=True).click()
            self.host.wait_for_function(f"players[{i}].badges.includes('Magic Kingdom')")
            for _ in range(6):
                if self.host.evaluate(f'currentPlayer!=={i}'):break
                choices=phone.locator('[data-room-action]:enabled');choices.first.wait_for(state='visible');choices.first.click();phone.wait_for_timeout(250)
            self.host.wait_for_function(f'currentPlayer==={(i+1)%5}')
        self.assertEqual(self.host.evaluate('players.map(p=>p.pos)'),[2]*5)
        # Emery's Popcorn power pin earns $50 on a correct badge question.
        self.assertEqual(self.host.evaluate('players.map(p=>p.cash)'),[1000,1000,1000,1000,1050])
        for player in self.host.evaluate('players'):self.assertIn('Magic Kingdom',player['badges'])


if __name__=='__main__':unittest.main()
