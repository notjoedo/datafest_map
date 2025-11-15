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
  scoreType: 'affordability' | 'prosperity'
  formData: {
    isMetro: boolean
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
        // Try multiple possible paths for the CSV
        let response = await fetch('/src/assets/affordabilityScores.csv').catch(() => null)
        if (!response || !response.ok) {
          response = await fetch('/affordabilityScores.csv').catch(() => null)
        }
        if (!response || !response.ok) {
          throw new Error('Could not load CSV file')
        }
        const text = await response.text()
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
        
        setAllCSVData(data)
        setLoading(false)
      } catch (err) {
        console.error('Error loading CSV:', err)
        setError('Failed to load data')
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
      const expectedIsMetro = formData.isMetro ? 'TRUE' : 'FALSE'
      const isMetroMatch = csvIsMetro === expectedIsMetro
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
        !isMetroMatch &&
        numKidsMatch &&
        numAdultsMatch &&
        highFoodMatch &&
        lowTransportMatch &&
        highHealthMatch
      )
    })

    // Create map with exact scores for each county that matches the form inputs
    // Each county should have exactly one matching row for the specific input combination
    const scoresMap = new Map<string, CountyData>()
    
    if (matchingRows.length > 0) {
      // Use the exact matching row's score for each county
      // Since each unique combination of inputs has one row per county, we should get one score per county
      matchingRows.forEach((row) => {
        // If a county already exists (shouldn't happen for exact match, but handle it)
        if (!scoresMap.has(row.county)) {
          scoresMap.set(row.county, {
            county: row.county,
            affordability_score: row.affordability_score,
            prosperity_score: row.prosperity_score,
          })
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
          const score = scoreType === 'affordability' ? affordabilityScore : prosperityScore
          
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
    if (score === 0) return '#e2e8f0' // Gray for no data
    
    // Based on CSV data, scores range roughly from -1 to 2
    // Normalize to 0-1 range for better color distribution
    const minScore = -1
    const maxScore = 2
    const normalized = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)))
    
    // Blue to green color scale for prosperity, red to yellow/green for affordability
    if (scoreType === 'prosperity') {
      // Blue (low) to green (high) - prosperity scale
      const r = Math.floor(59 + normalized * (34 - 59))
      const g = Math.floor(130 + normalized * (197 - 130))
      const b = Math.floor(246 + normalized * (94 - 246))
      return `rgb(${r}, ${g}, ${b})`
    } else {
      // Red (low affordability) to yellow/green (high affordability)
      const r = Math.floor(239 + normalized * (34 - 239))
      const g = Math.floor(68 + normalized * (197 - 68))
      const b = Math.floor(68 + normalized * (94 - 68))
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  // Style function for GeoJSON features
  const style = (feature: Feature | undefined) => {
    if (!feature) {
      return {
        fillColor: '#e2e8f0',
        fillOpacity: 0.3,
        color: '#ffffff',
        weight: 0.5,
        opacity: 0.5,
      }
    }
    const score = feature.properties?.score || 0
    return {
      fillColor: getColor(score),
      fillOpacity: score === 0 ? 0.3 : 0.7,
      color: '#ffffff',
      weight: 0.5,
      opacity: 0.5,
    }
  }

  // Event handlers
  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const score = feature.properties?.score || 0
    const countyName = feature.properties?.fullName || feature.properties?.NAME || 'Unknown'
    const affordabilityScore = feature.properties?.affordabilityScore || 0
    const prosperityScore = feature.properties?.prosperityScore || 0
    
    // Create tooltip with both scores, highlighting the current one
    const tooltipContent = score === 0 
      ? `<div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${countyName}</div><div style="color: #94a3b8; font-size: 12px;">No data available</div>`
      : `<div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${countyName}</div>
         <div style="margin-bottom: 4px;"><span style="font-weight: 600;">Affordability:</span> <span style="color: ${scoreType === 'affordability' ? '#3b82f6' : '#94a3b8'}; font-weight: ${scoreType === 'affordability' ? '700' : '400'}">${affordabilityScore.toFixed(3)}</span></div>
         <div><span style="font-weight: 600;">Prosperity:</span> <span style="color: ${scoreType === 'prosperity' ? '#3b82f6' : '#94a3b8'}; font-weight: ${scoreType === 'prosperity' ? '700' : '400'}">${prosperityScore.toFixed(3)}</span></div>`
    
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
          fillOpacity: score === 0 ? 0.5 : 0.9,
          color: '#1e293b',
          weight: 2.5,
          opacity: 0.9,
        })
        layer.openTooltip()
      },
      mouseout: (e) => {
        const layer = e.target
        const score = feature.properties?.score || 0
        // Reset to original style, preserving the score-based color
        layer.setStyle({
          fillColor: getColor(score),
          fillOpacity: score === 0 ? 0.3 : 0.7,
          color: '#ffffff',
          weight: 0.5,
          opacity: 0.5,
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
          Change the form inputs to see {scoreType === 'affordability' ? 'affordability' : 'prosperity'} scores on the map
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
      >
        <MapUpdater />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
          bottom: '20px',
          left: '20px',
          background: 'rgba(30, 41, 59, 0.9)',
          padding: '12px 16px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '0.875rem',
          zIndex: 1000,
          border: '1px solid rgba(148, 163, 184, 0.3)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>
          {scoreType === 'affordability' ? 'Affordability' : 'Prosperity'} Score
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Low</span>
          <div
            style={{
              width: '80px',
              height: '12px',
              background:
                scoreType === 'affordability'
                  ? 'linear-gradient(to right, rgb(239, 68, 68), rgb(34, 197, 94))'
                  : 'linear-gradient(to right, rgb(59, 130, 246), rgb(34, 197, 94))',
              borderRadius: '4px',
            }}
          />
          <span>High</span>
        </div>
      </div>
    </div>
  )
}

