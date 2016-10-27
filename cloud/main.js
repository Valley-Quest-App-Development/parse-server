
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.afterSave('QuestGPSSet', function(req, res) {
	var query = new Parse.Query("QuestGPSSet")

	console.log("Starting GPS job")
	console.log("Getting objects...")
	query.find({
		success: function(results) {
			var dictionary = {}; // In format: <String: {start: [], end: []}>
			
			console.log("Compiling GPS results...");

			for (i in results) {
				var result = results[i]
				var type = result.get("placeType");
				var loc = result.get("point");
				var quest = result.get("quest").id;

				var val = dictionary[quest];

				if (type == "start") {
					if (val == undefined) {
						dictionary[quest] = {start: [loc], end: []};
					}else{
						var start = val.start;
						start.push(loc);
						dictionary[quest] = {start: start, end: val.end};
					}
				}else{
					if (val == undefined) {
						dictionary[quest] = {start: [], end: [loc]};
					}else{
						var end = val.end;
						end.push(loc);
						dictionary[quest] = {start: val.start, end: end};
					}
				}
			}

			console.log(" ---> Complete")
			console.log(JSON.stringify(dictionary))

			var left = Object.keys(dictionary).length
			
			if (left == 0)
				console.log("No values to use. Done");
			else
				console.log(" ---> Averaging and saving...");

			// Now I will remove that ones that don't have enough data and average the rest
			for (questID in dictionary) {
				var val = dictionary[questID];

				if (val == undefined || val.start.length <= 1 || val.end.length <= 1) {
					delete dictionary[questID];
					left -= 1;
					continue;
					console.log("skipping " + questID);
				}else{
					console.log(val);
				}

				var totalLat = 0.0
				var totalLong = 0.0

				for (i in val.start) {
					totalLat += val.start[i].latitude
					totalLong += val.start[i].longitude
				}

				var startAvg = new Parse.GeoPoint(totalLat / val.start.length, totalLong / val.start.length)

				totalLat = 0.0
				totalLong = 0.0

				for (i in val.end) {
					totalLat += val.end[i].latitude
					totalLong += val.end[i].longitude
				}

				var endAvg = new Parse.GeoPoint(totalLat / val.end.length, totalLong / val.end.length)

				if (startAvg.milesTo(endAvg) < 0.1) {
					// This is an invalid point, as the difference between the start and end is too small
					// I would really like to delete all the ones that were involved in this one, but that will come later
					console.log("Found duplicate! Someone was testing!");
					console.log("TODO: remove duplicates!");
					continue;
				}

				console.log("\t\t\tSaving data...");
				var query = new Parse.Query("Quest");
				query.get(questID, {
					success: function(questObj) {
						questObj.set("gps_loc", startAvg);
						questObj.set("gps_end", {latitude: endAvg.latitude, longitude: endAvg.longitude})
						questObj.save();
						console.log("\t\t\tdone")

						left -= 1;

						if (left <= 0) {
							console.log(" ---> Done")
							res.success()
						}
					}
				});

				if (left <= 0) {
					console.log(" ---> Done")
					res.success()
				}
			}
		}
	});
});