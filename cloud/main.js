
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.afterSave('QuestGPSSet', function(req, res) {
	var query = new Parse.Query("QuestGPSSet")

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
			console.log(" ---> Averaging and saving...");

			var left = Object.keys(dictionary).length
			// Now I will remove that ones that don't have enough data and average the rest
			for (questID in dictionary) {
				var val = dictionary[questID];

				if (val == undefined || val.start.length < 2 || val.end.length < 2) {
					delete dictionary[questID];
					left -= 1;
					continue;
				}

				var totalLat = 0.0
				var totalLong = 0.0

				for (i in val.start) {
					totalLat += val[i].latitude
					totalLong += val[i].longitude
				}

				var startAvg = new Parse.GeoPoint(totalLat / val.start.length, totalLong / val.start.length)

				totalLat = 0.0
				totalLong = 0.0

				for (i in val.end) {
					totalLat += val[i].latitude
					totalLong += val[i].longitude
				}

				console.log("\t\t\tSaving data...")
				var query = new Parse.Query("Quest");
				query.get(quest, {
					success: function(questObj) {
						questObj.set("gps_loc", startAvg);
						questObj.set("gps_end", {latitude: totalLat / val.end.length, longitude: totalLong / val.end.length})
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