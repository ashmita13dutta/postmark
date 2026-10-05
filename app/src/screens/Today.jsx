import Screen from '../app/Screen'
import Stamp from '../components/stamp/Stamp'

// Sample palette from the mockup. Phase 1 only proves the empty stamp renders.
const SAMPLE = ['#3A5771', '#E7C64B', '#E39544', '#B14126', '#5B6470']

export default function Today() {
  return (
    <Screen caption="Postmark" title="Today">
      <div className="screen__stage">
        <Stamp colors={SAMPLE} no={1} seed="sample" width={200} label="Sample stamp" />
      </div>
      <p className="screen__note">The writing box and “Stamp it” arrive in the next phase.</p>
    </Screen>
  )
}
