import { useState } from 'react'
import './App.css'
import MapVisualization from './MapVisualization'

type ScoreType = 'affordability' | 'prosperity' | 'recommendation'

interface FormData {
  isMetro: boolean | null // null means "both"
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
  const [showQuestionnaire, setShowQuestionnaire] = useState(true)
  
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? checked : 
        (name === 'numKids' || name === 'numAdults') ? Number(value) : 
        value,
    }))
  }

  const handleQuestionnaireSubmit = () => {
    setShowQuestionnaire(false)
  }

  if (showQuestionnaire) {
    return (
      <div className="questionnaire-container">
        <div className="questionnaire-panel">
          <h1>Team Gigglebytes</h1>
          <br></br>
          <h2>Please fill out the questionnaire to proceed.</h2>
          <div className="questionnaire-form">
            <div className="question-group">
              <label className="question-label">Do you have a partner?</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="numAdults"
                    value="1"
                    checked={formData.numAdults === 1}
                    onChange={handleInputChange}
                  />
                  <span>No</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="numAdults"
                    value="2"
                    checked={formData.numAdults === 2}
                    onChange={handleInputChange}
                  />
                  <span>Yes</span>
                </label>
              </div>
            </div>

            <div className="question-group">
              <label className="question-label">How many kids do you have?</label>
              <div className="radio-group">
                {[0, 1, 2, 3].map((num) => (
                  <label key={num} className="radio-option">
                    <input
                      type="radio"
                      name="numKids"
                      value={num}
                      checked={formData.numKids === num}
                      onChange={handleInputChange}
                    />
                    <span>{num === 3 ? '3+' : num}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="question-group">
              <label className="question-label">Do you have preexisting health conditions?</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="HighHealthConditions"
                    value="no"
                    checked={formData.HighHealthConditions === false}
                    onChange={() => setFormData(prev => ({ ...prev, HighHealthConditions: false }))}
                  />
                  <span>No</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="HighHealthConditions"
                    value="yes"
                    checked={formData.HighHealthConditions === true}
                    onChange={() => setFormData(prev => ({ ...prev, HighHealthConditions: true }))}
                  />
                  <span>Yes</span>
                </label>
              </div>
            </div>

            <div className="question-group">
              <label className="question-label">How many times do you eat out a week?</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="HighFood"
                    value="low"
                    checked={formData.HighFood === false}
                    onChange={() => setFormData(prev => ({ ...prev, HighFood: false }))}
                  />
                  <span>0-4 times</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="HighFood"
                    value="high"
                    checked={formData.HighFood === true}
                    onChange={() => setFormData(prev => ({ ...prev, HighFood: true }))}
                  />
                  <span>More than 4</span>
                </label>
              </div>
            </div>

            <div className="question-group">
              <label className="question-label">How often do you take public transit?</label>
              <div className="radio-group-vertical">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="LowTransportation"
                    value="low"
                    checked={formData.LowTransportation === true}
                    onChange={() => setFormData(prev => ({ ...prev, LowTransportation: true }))}
                  />
                  <span>Never or Occasionally</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="LowTransportation"
                    value="high"
                    checked={formData.LowTransportation === false}
                    onChange={() => setFormData(prev => ({ ...prev, LowTransportation: false }))}
                  />
                  <span>Often or Primary Method</span>
                </label>
              </div>
            </div>

            <div className="question-group">
              <label className="question-label">Metro area preference:</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="isMetro"
                    value="no"
                    checked={formData.isMetro === false}
                    onChange={() => setFormData(prev => ({ ...prev, isMetro: false }))}
                  />
                  <span>Rural Only</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="isMetro"
                    value="yes"
                    checked={formData.isMetro === true}
                    onChange={() => setFormData(prev => ({ ...prev, isMetro: true }))}
                  />
                  <span>Metro Only</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="isMetro"
                    value="both"
                    checked={formData.isMetro === null}
                    onChange={() => setFormData(prev => ({ ...prev, isMetro: null }))}
                  />
                  <span>Both</span>
                </label>
              </div>
            </div>

            <div className="score-type-selector">
              <label className="question-label">What matters most to you?</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scoreType"
                    value="affordability"
                    checked={scoreType === 'affordability'}
                    onChange={() => setScoreType('affordability')}
                  />
                  <span>Affordability</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scoreType"
                    value="prosperity"
                    checked={scoreType === 'prosperity'}
                    onChange={() => setScoreType('prosperity')}
                  />
                  <span>Prosperity</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scoreType"
                    value="recommendation"
                    checked={scoreType === 'recommendation'}
                    onChange={() => setScoreType('recommendation')}
                  />
                  <span>Recommendation</span>
                </label>
              </div>
            </div>

            <button className="submit-questionnaire" onClick={handleQuestionnaireSubmit}>
              View Results
            </button>
              <div className="questionnaire-footer">
                  <p className="footer-emoji">Gigglebye 👋</p>
                  <p className="footer-title">Team Gigglebytes</p>
                  <p className="footer-subtitle">
                    Hoang (Joe) Do · Brendan Breitzmann · Charlie Keglovitz · Aman Anwar
                  </p>
                  <br/>
              </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="map-section">
        <MapVisualization 
          scoreType={scoreType} 
          formData={formData}
        />
      </div>

      <button
        type="button"
        className="back-to-questionnaire"
        onClick={() => {
          setShowQuestionnaire(true)
        }}
      >
        ← Back to Questionnaire
      </button>
    </div>
  )
}

export default App
