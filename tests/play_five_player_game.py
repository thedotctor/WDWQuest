"""Accelerated, reproducible five-player browser game through a real Castle Finale.

Uses ordinary UI decisions, random dice/cards, and real game accounting. Quiz
answers come from the game's question data; the first finale is intentionally
missed to check the required retry lap. No money, positions, badges, ownership,
or win requirements are injected. Reduced motion, the classic view, and skipped
presentation waits keep a long game practical to run in CI. External images are
blocked by the shared browser fixture; this checks gameplay, not photo delivery.
"""
import argparse
import json
from pathlib import Path
from test_board_game import BoardGameTests


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed',type=int,default=174513)
    parser.add_argument('--output',type=Path,default=Path('/tmp/wdwquest-five-player'))
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    BoardGameTests.setUpClass();test=BoardGameTests()
    try:
        test.setUp()
        test.page.on('console',lambda message:print(message.text,flush=True) if message.text.startswith('FULLGAME') else None)
        test.page.evaluate("""seed=>{Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}""",args.seed)
        test.start_five_player_game()
        test.page.locator('[data-camera="flat"]').click()
        script=Path(__file__).with_name('fixtures').joinpath('five_player_game.js').read_text()
        report=test.page.evaluate(script)
        report['seed']=args.seed;report['javascriptErrors']=test.errors
        args.output.joinpath('report.json').write_text(json.dumps(report,indent=2))
        test.page.locator('.game-layout').screenshot(path=str(args.output/'final-board.png'))
        assert report['gameOver'],'Game did not reach an ending'
        assert report['finaleAttempts']>=2,'Failed finale and retry were not exercised'
        assert any('completed the required lap' in message for message in report['log']),'Retry lap did not complete'
        assert not report['issues'],report['issues']
        assert 'wins WDWQuest' in report['final']['status'],'Missing actual Castle Finale victory'
        print(f"PASS: five players, {report['turns']} completed turns, {report['finaleAttempts']} finale attempts; {report['final']['status']}")
        test.tearDown()
    except BaseException:
        try:
            state=test.page.evaluate("({report:window.fullGameReport,modal:document.querySelector('#modalRoot')?.textContent})")
            args.output.joinpath('failure.json').write_text(json.dumps(state,indent=2))
        except Exception:
            pass
        raise
    finally:
        BoardGameTests.tearDownClass()


if __name__=='__main__':
    main()
