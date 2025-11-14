import { useState } from 'react'
import './App.css'
import MapVisualization from './MapVisualization'

type ScoreType = 'affordability' | 'prosperity'

interface FormData {
  isMetro: boolean
  numKids: number
  numAdults: number
  HighFood: boolean
  LowTransportation: boolean
  HighHealthConditions: boolean
}

function App() {
  const [scoreType, setScoreType] = useState<ScoreType>('affordability')
  const [formData, setFormData] = useState<FormData>({
    isMetro: false,
    numKids: 0,
    numAdults: 1,
    HighFood: false,
    LowTransportation: false,
    HighHealthConditions: false,
  })
  const [shouldCalculate, setShouldCalculate] = useState(false)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', { ...formData, scoreType })
    // Trigger map recalculation
    setShouldCalculate((prev) => !prev)
  }

  const scoreTypeLabel =
    scoreType === 'affordability' ? 'Affordability' : 'Prosperity'

  return (
    <div className="app-container">
      <div className="form-section">
        <h1>Score Calculator</h1>
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-button ${scoreType === 'affordability' ? 'active' : ''}`}
            onClick={() => setScoreType('affordability')}
          >
            Affordability Score
          </button>
          <button
            type="button"
            className={`tab-button ${scoreType === 'prosperity' ? 'active' : ''}`}
            onClick={() => setScoreType('prosperity')}
          >
            Prosperity Score
          </button>
        </div>
        <form onSubmit={handleSubmit} className="affordability-form">
          <div className="form-section-header">
            <h2>Household Information</h2>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="numAdults">Number of Adults</label>
              <input
                type="number"
                id="numAdults"
                name="numAdults"
                value={formData.numAdults}
                onChange={handleInputChange}
                min="1"
                max="2"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="numKids">Number of Kids</label>
              <input
                type="number"
                id="numKids"
                name="numKids"
                value={formData.numKids}
                onChange={handleInputChange}
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-section-divider"></div>

          <div className="form-section-header">
            <h2>Location & Lifestyle Factors</h2>
          </div>

          <div className="form-group checkbox-group">
            <div className="checkbox-options">
              <label>
                <input
                  type="checkbox"
                  name="isMetro"
                  checked={formData.isMetro}
                  onChange={handleInputChange}
                />
                Metro Area
              </label>
              <label>
                <input
                  type="checkbox"
                  name="HighFood"
                  checked={formData.HighFood}
                  onChange={handleInputChange}
                />
                High Food Costs
              </label>
              <label>
                <input
                  type="checkbox"
                  name="LowTransportation"
                  checked={formData.LowTransportation}
                  onChange={handleInputChange}
                />
                Low Transportation Costs
              </label>
              <label>
                <input
                  type="checkbox"
                  name="HighHealthConditions"
                  checked={formData.HighHealthConditions}
                  onChange={handleInputChange}
                />
                High Health Conditions
              </label>
            </div>
          </div>

          <button type="submit" className="submit-button">
            Calculate {scoreTypeLabel} Score
          </button>
        </form>
      </div>

      <div className="map-section">
        <MapVisualization 
          scoreType={scoreType} 
          formData={formData} 
          triggerUpdate={shouldCalculate}
        />
      </div>
    </div>
  )
}

export default App
