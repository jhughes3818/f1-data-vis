const express = require("express");
const axios = require("axios");
const app = express();
const port = 3000;

app.get("/season-prediction", (req, res) => {
  //Holds the basic data for prediction analysis
  let seasonRaces = []; //Holds list of the races in the season selected
  let seasonStandings = [];
  let data = [];

  //Primary Function Called on Button Click
  async function getRaces() {
    //First, we get the list of races
    await axios
      .get("http://ergast.com/api/f1/current.json")
      .then((response) => {
        let races = response.data.MRData.RaceTable.Races;

        const date = new Date();

        let day = date.getDate();
        let month = date.getMonth() + 1;
        let year = date.getFullYear();

        // This arrangement can be altered based on how we want the date's format to appear.
        let currentDateString = `${year}-${month}-${day}`;
        let currentDate = Date.parse(currentDateString);

        let comparisonDate = currentDate;

        //Adds races up in the season to seasonRaces, if current season adds all races that have already occurred.
        races.forEach((race) => {
          if (Date.parse(race.date) < comparisonDate) {
            seasonRaces.push(race.round);

            console.log("Added Round " + race.round);
          }
        });
      });

    console.log("Finished Getting Races");
    console.log(seasonRaces);
    //Now, call function to populate the standings & points for each race.
    await getStandings();
    //Run prediction algorithm
    await getLeader();
    //Set loading to false, to allow the chart to be rendered
  }

  //Downloads all points data for the races retrieved.
  async function getStandings() {
    //First, loop through the races
    for (const race of seasonRaces) {
      let raceStandings = [];
      let url =
        "https://ergast.com/api/f1/2022/" + race + "/driverStandings.json";
      await axios.get(url).then((response) => {
        let standings =
          response.data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
        //Loop though each driver retrieved and add relevant data to the raceStandings array
        standings.forEach((driver) => {
          let newData = {
            position: driver.position,
            points: driver.points,
            fName: driver.Driver.givenName,
            lName: driver.Driver.familyName,
          };
          raceStandings.push(newData);
        });
      });
      //Push all standings data to seasonStandings array
      //The results is an array with an each entry including being an array of objects, each object representing a driver
      seasonStandings.push(raceStandings);
      console.log("Added Standings");
    }
  }

  //Prediction Algorithm - does the prediction and formats data ready for chart
  function getLeader() {
    //Holds the total points for each driver over the season
    let driverSeasonPoints = [];

    //Holds a list of the drivers names
    let drivers = [];

    seasonStandings.slice(-1)[0].forEach((driver) => {
      drivers.push(driver.lName);
    });

    //Loop through drivers and get the total points at each race
    drivers.forEach((driver) => {
      let driverPoints = [];
      let newRaceData = [];
      seasonStandings.forEach((race) => {
        race.forEach((entrant) => {
          if (entrant.lName === driver) {
            newRaceData.push(entrant.points);
          }
        });
      });
      driverPoints.push(newRaceData);
      //Construct object with driver name and points array
      let driverRaceData = {
        name: driver,
        points: driverPoints,
      };
      //Push to driver season points
      driverSeasonPoints.push(driverRaceData);
    });

    //Holds each drivers latest average points gained
    let driverAveragePointsByRace = [];

    //Calculate average points gained in last 5 races, or all races to that point
    //Predicts finishing points for the season
    driverSeasonPoints.forEach((driver) => {
      let pointsGainedArray = [];
      let pointsAverage = [];
      let finishingPointsPrediction = [];
      for (let i = 0; i < driver.points[0].length; i++) {
        //Build points gained array

        let pointsGained = driver.points[0][i] - driver.points[0][i - 1];
        if (pointsGained >= 0) {
          pointsGainedArray.push(pointsGained);
        } else {
          pointsGainedArray.push(0);
        }

        //If in first 5 races, average of whole array
        if (i === 0) {
          let racesRemaining = seasonRaces.length - i;
          //Holds predicton value
          let prediction = Number(driver.points[0][i]) * racesRemaining;
          if (prediction > 0) {
            finishingPointsPrediction.push(Math.round(prediction));
          } else {
            finishingPointsPrediction.push(
              Math.round(Number(driver.points[0][i]))
            );
          }
        } else if (i < 6) {
          let count = 0;
          let total = 0;
          pointsGainedArray.forEach((entry) => {
            total += entry;
            count++;
          });
          pointsAverage.push(total / count);
          //Get total races remaining
          let racesRemaining = seasonRaces.length - i;
          //Holds prediction value
          let prediction =
            Number(driver.points[0][i]) + (total / count) * racesRemaining;

          //Only adds prediction value when it is >0, otherwise just pushes current points
          if (prediction > 0) {
            finishingPointsPrediction.push(Math.round(prediction));
          } else {
            finishingPointsPrediction.push(
              Math.round(Number(driver.points[0][i]))
            );
          }
        } else {
          let count = 0;
          let total = 0;
          //Same as above, but calculates average of last 5 races only
          pointsGainedArray.slice(-5).forEach((entry) => {
            total += entry;
            count++;
          });
          pointsAverage.push(total / count);
          let racesRemaining = seasonRaces.length - i;
          let prediction =
            Number(driver.points[0][i]) + (total / count) * racesRemaining;
          if (prediction > 0) {
            finishingPointsPrediction.push(Math.floor(prediction));
          } else {
            finishingPointsPrediction.push(Number(driver.points[0][i]));
          }
        }
      }
      //Sets driver colors
      let color = "";
      if (driver.name === "Leclerc" || driver.name === "Sainz") {
        color = "#DC0000";
      } else if (driver.name === "Pérez" || driver.name === "Verstappen") {
        color = "#0600EF";
      } else if (driver.name === "Russell" || driver.name === "Hamilton") {
        color = "#00D2BE";
      } else if (driver.name === "Norris" || driver.name === "Ricciardo") {
        color = "#FF8700";
      } else if (driver.name === "Ocon" || driver.name === "Alonso") {
        color = "#0090FF";
      } else if (driver.name === "Bottas" || driver.name === "Zhou") {
        color = "#900000";
      } else if (driver.name === "Gasly" || driver.name === "Tsunoda") {
        color = "#2B4562";
      } else if (driver.name === "Magnussen" || driver.name === "Schumacher") {
        color = "#FFFFFF";
      } else if (driver.name === "Vettel" || driver.name === "Stroll") {
        color = "#006F62";
      } else if (driver.name === "Albon" || driver.name === "Latifi") {
        color = "#005AFF";
      } else {
        color = "#999999";
      }

      //Constructs chart data object
      let newData = {
        name: driver.name,
        data: finishingPointsPrediction,
        color: color,
      };
      driverAveragePointsByRace.push(newData);
    });

    console.log(driverAveragePointsByRace);

    //Construct chart data object
    let data = [];

    driverAveragePointsByRace.slice(0, 6).forEach((driver) => {
      let newData = {
        label: driver.name,
        data: driver.data,
        borderColor: driver.color,
        fill: driver.color,
        enabled: false,
      };
      data.push(newData);
    });
    res.send(data);
  }

  getRaces();
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
