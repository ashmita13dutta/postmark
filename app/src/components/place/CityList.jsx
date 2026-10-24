import { cityNames } from '../../engine/city'

/** The suggestions behind a "home city" box: `<input list="postmark-cities">` finds this by its id. */
export default function CityList() {
  return (
    <datalist id="postmark-cities">
      {cityNames.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  )
}
