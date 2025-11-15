import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FeatureCollection, Feature } from 'geojson'

// Fix for default marker icons in React/Webpack
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

interface CountyData {
  county: string
  affordability_score: number
  prosperity_score: number
}

interface MapVisualizationProps {
  scoreType: 'affordability' | 'prosperity' | 'recommendation'
  formData: {
    isMetro: boolean | null // null means "both"
    numKids: number
    numAdults: number
    HighFood: boolean
    LowTransportation: boolean
    HighHealthConditions: boolean
  }
}

// Component to update map bounds when data changes
function MapUpdater() {
  const map = useMap()
  
  useEffect(() => {
    map.fitBounds([
      [24.396308, -125.0],
      [49.384358, -66.93457],
    ] as L.LatLngBoundsExpression)
  }, [map])

  return null
}

export default function MapVisualization({ scoreType, formData }: MapVisualizationProps) {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null)
  const [countyScores, setCountyScores] = useState<Map<string, CountyData>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)

  const [allCSVData, setAllCSVData] = useState<Array<{
    county: string
    isMetro: string
    numKids: string
    numAdults: string
    HighFood: string
    LowTransportation: string
    HighHealthConditions: string
    affordability_score: number
    prosperity_score: number
  }>>([])

  // Load all CSV data once
  useEffect(() => {
    const loadCSVData = async () => {
      try {
        const csvPath = '/affordabilityScores.csv'
        console.log('Loading CSV from:', csvPath)
        // Fetch from public folder
        const response = await fetch(csvPath)
        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`)
        }
        const text = await response.text()
        console.log('CSV loaded successfully, length:', text.length)
        const lines = text.split('\n').slice(1) // Skip header
        
        const data: typeof allCSVData = []
        
        lines.forEach((line) => {
          if (!line.trim()) return
          
          const parts = line.split(',')
          if (parts.length < 9) return
          
          const [county, isMetro, numKids, numAdults, HighFood, LowTransportation, HighHealthConditions, affordability_score, prosperity_score] = 
            parts.map(s => s.trim())
          
          if (!county || county === 'county' || !isMetro || !numKids || !numAdults) return
          
          data.push({
            county,
            isMetro,
            numKids,
            numAdults,
            HighFood,
            LowTransportation,
            HighHealthConditions,
            affordability_score: parseFloat(affordability_score) || 0,
            prosperity_score: parseFloat(prosperity_score) || 0,
          })
        })
        
        console.log('Parsed CSV rows:', data.length)
        setAllCSVData(data)
        setLoading(false)
      } catch (err) {
        console.error('Error loading CSV:', err)
        setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setLoading(false)
      }
    }

    loadCSVData()
  }, [])

  // Filter and process CSV data based on form inputs - updates in real-time
  useEffect(() => {
    if (allCSVData.length === 0) return

    // Filter rows that match the exact form criteria
    const matchingRows = allCSVData.filter((row) => {
      const csvIsMetro = row.isMetro.trim().toUpperCase()
      // If isMetro is null, show both (match any value)
      // Otherwise, match the specific metro/rural preference
      const isMetroMatch = formData.isMetro === null 
        ? true // Show both metro and rural
        : csvIsMetro === (formData.isMetro ? 'TRUE' : 'FALSE')
      // For numKids: if input is >= 3, use 3 for matching; otherwise use the actual value
      const effectiveNumKids = formData.numKids >= 3 ? 3 : formData.numKids
      const rowNumKids = parseInt(row.numKids.trim(), 10)
      const rowNumAdults = parseInt(row.numAdults.trim(), 10)
      const numKidsMatch = !isNaN(rowNumKids) && rowNumKids === effectiveNumKids
      const numAdultsMatch = !isNaN(rowNumAdults) && rowNumAdults === formData.numAdults
      // For Y/N fields: normalize to uppercase for case-insensitive matching
      const highFoodMatch = row.HighFood.trim().toUpperCase() === (formData.HighFood ? 'Y' : 'N')
      const lowTransportMatch = row.LowTransportation.trim().toUpperCase() === (formData.LowTransportation ? 'Y' : 'N')
      const highHealthMatch = row.HighHealthConditions.trim().toUpperCase() === (formData.HighHealthConditions ? 'Y' : 'N')

      return (
        isMetroMatch &&
        numKidsMatch &&
        numAdultsMatch &&
        highFoodMatch &&
        lowTransportMatch &&
        highHealthMatch
      )
    })

    // Create map with exact scores for each county that matches the form inputs
    // When "Both" is selected (isMetro === null), we may have multiple rows per county (metro and rural)
    // In that case, we average the scores
    const scoresMap = new Map<string, CountyData>()
    const countyCounts = new Map<string, number>() // Track how many rows per county for averaging
    
    if (matchingRows.length > 0) {
      matchingRows.forEach((row) => {
        if (scoresMap.has(row.county)) {
          // County already exists - average the scores (for "Both" option)
          const existing = scoresMap.get(row.county)!
          const count = (countyCounts.get(row.county) || 1) + 1
          scoresMap.set(row.county, {
            county: row.county,
            affordability_score: (existing.affordability_score * (count - 1) + row.affordability_score) / count,
            prosperity_score: (existing.prosperity_score * (count - 1) + row.prosperity_score) / count,
          })
          countyCounts.set(row.county, count)
        } else {
          // First row for this county
          scoresMap.set(row.county, {
            county: row.county,
            affordability_score: row.affordability_score,
            prosperity_score: row.prosperity_score,
          })
          countyCounts.set(row.county, 1)
        }
      })
    }
    
    setCountyScores(scoresMap)
    // Mark as calculated once we've processed the data (even if no matches found)
    if (allCSVData.length > 0) {
      setHasCalculated(true)
    }
  }, [allCSVData, formData])

  // Helper function to normalize county names for matching
  const normalizeCountyName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/ county/gi, '')
      .replace(/ parish/gi, '')
      .trim()
  }



  // Load US counties GeoJSON
  useEffect(() => {
    const loadGeoJSON = async () => {
      try {
        // Using US counties GeoJSON from a public source
        // This uses FIPS codes - we'll match by county and state names
        const response = await fetch(
          'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json'
        )
        
        if (!response.ok) {
          throw new Error('Failed to load GeoJSON')
        }
        
        const data: FeatureCollection = await response.json()
        
        // State FIPS to abbreviation mapping (simplified - would need full list)
        const stateFipsToAbbrev: Record<string, string> = {
          '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
          '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
          '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
          '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
          '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
          '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
          '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
          '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
          '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
          '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'
        }
        
        // Process the GeoJSON to match county names
        const processedFeatures = data.features.map((feature) => {
          const countyName = feature.properties?.NAME || ''
          const fips = feature.properties?.GEO_ID || ''
          const stateFips = fips.split('US')[1]?.slice(0, 2) || ''
          const stateAbbrev = stateFipsToAbbrev[stateFips] || ''
          const fullName = `${countyName} ${stateAbbrev}`.trim()
          
          // Find matching county data from CSV
          const normalizedCounty = normalizeCountyName(countyName)
          const stateAbbrevUpper = stateAbbrev.toUpperCase().slice(0, 2)
          
          let affordabilityScore = 0
          let prosperityScore = 0
          
          for (const [csvKey, value] of countyScores.entries()) {
            const csvParts = csvKey.split(' ')
            const csvCounty = csvParts.slice(0, -1).join(' ')
            const csvState = csvParts[csvParts.length - 1]
            
            if (csvState === stateAbbrevUpper) {
              const normalizedCsvCounty = normalizeCountyName(csvCounty)
              if (
                normalizedCsvCounty === normalizedCounty ||
                normalizedCsvCounty.includes(normalizedCounty) ||
                normalizedCounty.includes(normalizedCsvCounty)
              ) {
                affordabilityScore = value.affordability_score
                prosperityScore = value.prosperity_score
                break
              }
            }
          }
          
          // Set score based on current scoreType
          // For recommendation: average of (inverse normalized affordability + normalized prosperity)
          let score = 0
          if (scoreType === 'recommendation') {
            const minScore = -1
            const maxScore = 2
            // Normalize both scores to 0-1 range
            const normalizedAffordability = Math.max(0, Math.min(1, (affordabilityScore - minScore) / (maxScore - minScore)))
            const normalizedProsperity = Math.max(0, Math.min(1, (prosperityScore - minScore) / (maxScore - minScore)))
            // Invert affordability (lower affordability score = more affordable = better)
            const invertedAffordability = 1 - normalizedAffordability
            // Average: (inverse affordability + prosperity) / 2
            const recommendationNormalized = (invertedAffordability + normalizedProsperity) / 2
            // Scale back to original range for consistent coloring
            score = recommendationNormalized * (maxScore - minScore) + minScore
          } else if (scoreType === 'affordability') {
            score = affordabilityScore
          } else {
            score = prosperityScore
          }
          
          return {
            ...feature,
            properties: {
              ...feature.properties,
              score,
              affordabilityScore,
              prosperityScore,
              fullName,
              countyName,
              stateAbbrev,
            },
          }
        })
        
        setGeoJsonData({
          ...data,
          features: processedFeatures,
        })
        
        setLoading(false)
      } catch (err) {
        console.error('Error loading GeoJSON:', err)
        setError('Failed to load map data')
        setLoading(false)
      }
    }

    if (countyScores.size > 0) {
      loadGeoJSON()
    }
  }, [countyScores, scoreType])

  // Color scale function - analyze score distribution
  const getColor = (score: number): string => {
    if (score === 0) return '#e8e3d8' // Cream gray for no data
    
    // Based on CSV data, scores range roughly from -1 to 2
    // Normalize to 0-1 range for better color distribution
    const minScore = -1
    const maxScore = 2
    let normalized = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)))
    
    // For affordability: higher score = more expensive (bad) = red
    // For prosperity: higher score = better = green
    // For recommendation: higher score = better balance = green (already in correct direction)
    // So flip the normalized value for affordability
    if (scoreType === 'affordability') {
      normalized = 1 - normalized
    }
    // Recommendation scores are already normalized with affordability inverted, so they're already in the right direction
    
    // Red (low) to green (high) gradient
    // Red: rgb(220, 38, 38) -> Yellow: rgb(234, 179, 8) -> Green: rgb(34, 197, 94)
    if (normalized < 0.5) {
      // Red to yellow (first half)
      const t = normalized * 2 // 0 to 1
      const r = Math.floor(220 + t * (234 - 220))
      const g = Math.floor(38 + t * (179 - 38))
      const b = Math.floor(38 + t * (8 - 38))
      return `rgb(${r}, ${g}, ${b})`
    } else {
      // Yellow to green (second half)
      const t = (normalized - 0.5) * 2 // 0 to 1
      const r = Math.floor(234 + t * (34 - 234))
      const g = Math.floor(179 + t * (197 - 179))
      const b = Math.floor(8 + t * (94 - 8))
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  // Style function for GeoJSON features
  const style = (feature: Feature | undefined) => {
    if (!feature) {
      return {
        fillColor: '#e2e8f0',
        fillOpacity: 0.3,
        color: '#cbd5e1',
        weight: 0.5,
        opacity: 0.4,
      }
    }
    const score = feature.properties?.score || 0
    return {
      fillColor: getColor(score),
      fillOpacity: score === 0 ? 0.4 : 0.8,
      color: '#e8e3d8',
      weight: 0.5,
      opacity: 0.6,
    }
  }

  // Event handlers
  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const score = feature.properties?.score || 0
    const countyName = feature.properties?.fullName || feature.properties?.NAME || 'Unknown'
    const affordabilityScore = feature.properties?.affordabilityScore || 0
    const prosperityScore = feature.properties?.prosperityScore || 0
    
    // Create tooltip with scores, highlighting the current one
    let currentScoreName = 'Affordability'
    let currentScoreValue = affordabilityScore
    let otherScoreName = 'Prosperity'
    let otherScoreValue = prosperityScore
    
    if (scoreType === 'recommendation') {
      // Calculate recommendation score for display
      const minScore = -1
      const maxScore = 2
      const normalizedAffordability = Math.max(0, Math.min(1, (affordabilityScore - minScore) / (maxScore - minScore)))
      const normalizedProsperity = Math.max(0, Math.min(1, (prosperityScore - minScore) / (maxScore - minScore)))
      const invertedAffordability = 1 - normalizedAffordability
      const recommendationNormalized = (invertedAffordability + normalizedProsperity) / 2
      const recommendationScore = recommendationNormalized * (maxScore - minScore) + minScore
      
      currentScoreName = 'Recommendation'
      currentScoreValue = recommendationScore
    } else if (scoreType === 'prosperity') {
      currentScoreName = 'Prosperity'
      currentScoreValue = prosperityScore
      otherScoreName = 'Affordability'
      otherScoreValue = affordabilityScore
    }
    
    let tooltipContent = ''
    if (score === 0) {
      tooltipContent = `<div style="font-weight: 700; font-size: 17px; color: #2b2520; margin-bottom: 6px;">${countyName}</div><div style="color: #6b5d52; font-size: 14px;">No data available</div>`
    } else if (scoreType === 'recommendation') {
      tooltipContent = `<div style="font-weight: 700; font-size: 17px; color: #2b2520; margin-bottom: 10px; line-height: 1.3;">${countyName}</div>
         <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(234, 88, 12, 0.1); border-radius: 10px; margin-bottom: 8px; border: 1.5px solid rgba(234, 88, 12, 0.2);">
           <span style="font-weight: 700; font-size: 14px; color: #2b2520;">${currentScoreName}</span>
           <span style="color: #ea580c; font-weight: 700; font-size: 17px;">${currentScoreValue.toFixed(2)}</span>
         </div>
         <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(245, 241, 232, 0.8); border-radius: 10px; margin-bottom: 6px; border: 1.5px solid rgba(232, 227, 216, 0.8);">
           <span style="font-weight: 600; font-size: 14px; color: #2b2520;">Affordability</span>
           <span style="color: #2b2520; font-weight: 700; font-size: 17px;">${affordabilityScore.toFixed(2)}</span>
         </div>
         <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(245, 241, 232, 0.8); border-radius: 10px; border: 1.5px solid rgba(232, 227, 216, 0.8);">
           <span style="font-weight: 600; font-size: 14px; color: #2b2520;">Prosperity</span>
           <span style="color: #2b2520; font-weight: 700; font-size: 17px;">${prosperityScore.toFixed(2)}</span>
         </div>`
    } else {
      tooltipContent = `<div style="font-weight: 700; font-size: 17px; color: #2b2520; margin-bottom: 10px; line-height: 1.3;">${countyName}</div>
         <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(234, 88, 12, 0.1); border-radius: 10px; margin-bottom: 8px; border: 1.5px solid rgba(234, 88, 12, 0.2);">
           <span style="font-weight: 700; font-size: 14px; color: #2b2520;">${currentScoreName}</span>
           <span style="color: #ea580c; font-weight: 700; font-size: 17px;">${currentScoreValue.toFixed(2)}</span>
         </div>
         <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(245, 241, 232, 0.8); border-radius: 10px; border: 1.5px solid rgba(232, 227, 216, 0.8);">
           <span style="font-weight: 600; font-size: 14px; color: #2b2520;">${otherScoreName}</span>
           <span style="color: #2b2520; font-weight: 700; font-size: 17px;">${otherScoreValue.toFixed(2)}</span>
         </div>`
    }
    
    layer.bindTooltip(
      tooltipContent,
      { 
        permanent: false, 
        sticky: true,
        className: 'custom-tooltip',
        direction: 'top',
        offset: [0, -10]
      }
    )
    
    layer.on({
      mouseover: (e) => {
        const layer = e.target
        const score = feature.properties?.score || 0
        // Preserve the original fill color, just enhance the border and opacity
        layer.setStyle({
          fillColor: getColor(score),
          fillOpacity: score === 0 ? 0.6 : 0.95,
          color: '#ea580c',
          weight: 2,
          opacity: 1,
        })
        layer.openTooltip()
      },
      mouseout: (e) => {
        const layer = e.target
        const score = feature.properties?.score || 0
        // Reset to original style, preserving the score-based color
        layer.setStyle({
          fillColor: getColor(score),
          fillOpacity: score === 0 ? 0.4 : 0.8,
          color: '#e8e3d8',
          weight: 0.5,
          opacity: 0.6,
        })
        layer.closeTooltip()
      },
    })
  }

  if (loading) {
    return (
      <div className="map-placeholder">
        <p>Loading map data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="map-placeholder">
        <p>{error}</p>
        <p className="placeholder-subtitle">
          Map visualization unavailable. Please check your data connection.
        </p>
      </div>
    )
  }

  // Show initial state message if no data has been calculated yet
  if (!hasCalculated && countyScores.size === 0 && !loading) {
    return (
      <div className="map-placeholder">
        <p>Map will update as you adjust the form</p>
        <p className="placeholder-subtitle">
          Change the form inputs to see {scoreType === 'affordability' ? 'affordability' : scoreType === 'prosperity' ? 'prosperity' : 'recommendation'} scores on the map
        </p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', minHeight: 0 }}>
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ height: '100%', width: '100%', zIndex: 0, minHeight: 0 }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <MapUpdater />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          minZoom={2}
          crossOrigin="anonymous"
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        />
        {geoJsonData && countyScores.size > 0 && (
          <GeoJSON
            key={`${scoreType}-${countyScores.size}`}
            data={geoJsonData}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          background: 'rgba(254, 253, 251, 0.95)',
          padding: '14px 18px',
          borderRadius: '16px',
          color: '#2b2520',
          fontSize: '0.875rem',
          zIndex: 1000,
          border: '1px solid #e8e3d8',
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem', letterSpacing: '-0.01em', color: '#2b2520' }}>
          {scoreType === 'affordability' ? 'Affordability' : scoreType === 'prosperity' ? 'Prosperity' : 'Recommendation'} Score
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b5d52' }}>
            {scoreType === 'affordability' ? 'More Affordable' : 'Low'}
          </span>
          <div
            style={{
              width: '100px',
              height: '10px',
              background: scoreType === 'affordability'
                ? 'linear-gradient(to right, rgb(34, 197, 94), rgb(234, 179, 8), rgb(220, 38, 38))'
                : 'linear-gradient(to right, rgb(220, 38, 38), rgb(234, 179, 8), rgb(34, 197, 94))',
              borderRadius: '999px',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
            }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b5d52' }}>
            {scoreType === 'affordability' ? 'More Expensive' : 'High'}
          </span>
        </div>
      </div>
    </div>
  )
}

