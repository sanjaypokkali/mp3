// Load required packages
var mongoose = require('mongoose');

// Define our user schema
var TaskSchema = new mongoose.Schema({
    // name: {type: String, required: true},
    // email: {type: String, required: true, unique: true},
    // pendingTasks: [String],
    // dateCreated: {type: Date, default: Date.now}
    name: {type: String, required: true},
    description: {type: String},
    deadline: {type: Date},
    completed: {type: Boolean},
    assignedUser: {type: String},
    assignedUserName: {type: String, default: "unassigned"},
    dateCreated: {type: Date, default: Date.now}

});

// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);
