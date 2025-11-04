var User = require('../models/user')
var Task = require('../models/task')
var mongoose = require('mongoose')
module.exports = (router) => {

    var userRoute = router.route("/users")
    var singleUserRoute = router.route("/users/:id")

    userRoute.get((req, res) => {
        try {
            // Parse where filter first (used for both find and count)
            let whereFilter = {};
            if (req.query.where) {
                try {
                    whereFilter = JSON.parse(req.query.where);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'where' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            // Handle 'count' parameter - count only uses where filter
            if (req.query.count === 'true') {
                User.countDocuments(whereFilter).exec((err, count) => {
                    if (err) {
                        return res.status(500).json({
                            message: "Server error occurred while counting users.",
                            data: {}
                        });
                    }
                    return res.status(200).json({
                        message: "OK",
                        data: count
                    });
                });
                return;
            }

            // Build the query using Mongoose methods for find operations
            let query = User.find(whereFilter);

            // Handle 'sort' parameter
            if (req.query.sort) {
                try {
                    const sortObj = JSON.parse(req.query.sort);
                    query = query.sort(sortObj);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'sort' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            // Handle 'select' parameter
            if (req.query.select) {
                try {
                    const selectObj = JSON.parse(req.query.select);
                    query = query.select(selectObj);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'select' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            // Handle 'skip' parameter
            if (req.query.skip) {
                const skip = parseInt(req.query.skip);
                if (isNaN(skip) || skip < 0) {
                    return res.status(400).json({
                        message: "Invalid 'skip' parameter. Must be a non-negative integer.",
                        data: {}
                    });
                }
                query = query.skip(skip);
            }

            // Handle 'limit' parameter (unlimited by default for users)
            if (req.query.limit) {
                const limit = parseInt(req.query.limit);
                if (isNaN(limit) || limit < 0) {
                    return res.status(400).json({
                        message: "Invalid 'limit' parameter. Must be a non-negative integer.",
                        data: {}
                    });
                }
                query = query.limit(limit);
            }

            // Execute the query and return results
            query.exec((err, users) => {
                if (err) {
                    return res.status(500).json({
                        message: "Server error occurred while retrieving users.",
                        data: {}
                    });
                }
                return res.status(200).json({
                    message: "OK",
                    data: users
                });
            });
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    userRoute.post((req, res) => {
        try {
            // Validate required fields
            if (!req.body.name || req.body.name.trim() === '') {
                return res.status(400).json({
                    message: "User name is required.",
                    data: {}
                });
            }

            if (!req.body.email || req.body.email.trim() === '') {
                return res.status(400).json({
                    message: "User email is required.",
                    data: {}
                });
            }

            // Create new user object with provided fields and defaults
            const userData = {
                name: req.body.name.trim(),
                email: req.body.email.trim()
            };

            // Set default values for fields not specified
            if (req.body.pendingTasks !== undefined) {
                // Deduplicate and normalize to strings
                const uniquePending = Array.from(new Set((req.body.pendingTasks || []).map(t => t.toString())));
                userData.pendingTasks = uniquePending;
            } else {
                userData.pendingTasks = [];
            }

            // dateCreated will be set automatically by Mongoose default

            // Create new user
            const newUser = new User(userData);
            newUser.save((err, user) => {
                if (err) {
                    // Check for duplicate email error (unique constraint violation)
                    // MongoDB error code 11000 indicates duplicate key error
                    if (err.code === 11000) {
                        return res.status(400).json({
                            message: "A user with this email already exists.",
                            data: {}
                        });
                    }

                    return res.status(500).json({
                        message: "Server error occurred while creating user.",
                        data: {}
                    });
                }

                return res.status(201).json({
                    message: "OK",
                    data: user
                });
            });
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    singleUserRoute.get((req, res) => {
        try {
            // Build the query starting with findById
            let query = User.findById(req.params.id);

            // Handle 'select' parameter (as mentioned in requirements)
            if (req.query.select) {
                try {
                    const selectObj = JSON.parse(req.query.select);
                    query = query.select(selectObj);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'select' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            // Execute the query
            query.exec((err, user) => {
                if (err) {
                    return res.status(500).json({
                        message: "Server error occurred while retrieving user.",
                        data: {}
                    });
                }

                // User not found
                if (!user) {
                    return res.status(404).json({
                        message: "User not found.",
                        data: {}
                    });
                }

                // Successfully found user
                return res.status(200).json({
                    message: "OK",
                    data: user
                });
            });
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    singleUserRoute.put((req, res) => {
        try {
            // Validate required fields
            if (!req.body.name || req.body.name.trim() === '') {
                return res.status(400).json({
                    message: "User name is required.",
                    data: {}
                });
            }

            if (!req.body.email || req.body.email.trim() === '') {
                return res.status(400).json({
                    message: "User email is required.",
                    data: {}
                });
            }

            // Validate user ID format (MongoDB ObjectId)
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(400).json({
                    message: "Invalid user ID format.",
                    data: {}
                });
            }

            // First, find the existing user to get their old pendingTasks
            User.findById(req.params.id, (err, existingUser) => {
                if (err) {
                    if (err.name === 'CastError') {
                        return res.status(400).json({
                            message: "Invalid user ID format.",
                            data: {}
                        });
                    }
                    return res.status(500).json({
                        message: "Server error occurred while retrieving user.",
                        data: {}
                    });
                }

                if (!existingUser) {
                    return res.status(404).json({
                        message: "User not found.",
                        data: {}
                    });
                }

                // Store old pendingTasks for two-way reference maintenance
                const oldPendingTasks = (existingUser.pendingTasks || []).map(t => t.toString());
                // Deduplicate new pending tasks and normalize to strings
                const rawNew = req.body.pendingTasks !== undefined ? req.body.pendingTasks : [];
                const newPendingTasks = Array.from(new Set(rawNew.map(t => t.toString())));
                
                // Validate task ID formats in newPendingTasks
                const invalidTaskIds = newPendingTasks.filter(taskId => !mongoose.Types.ObjectId.isValid(taskId));
                if (invalidTaskIds.length > 0) {
                    return res.status(400).json({
                        message: "Invalid task ID format.",
                        data: {}
                    });
                }
                
                // Compute tasks being added (present in new but not in old)
                const oldTaskSet = new Set(oldPendingTasks.map(t => t.toString()));
                const tasksToAdd = newPendingTasks.filter(taskId => !oldTaskSet.has(taskId.toString()));
                
                if (tasksToAdd.length > 0) {
                    // Check if any of the tasks to add are not completed
                    Task.find({ _id: { $in: tasksToAdd } }, (err, tasks) => {
                        if (err) {
                            return res.status(500).json({
                                message: "Server error occurred while validating tasks.",
                                data: {}
                            });
                        }

                        // Check if any task is completed
                        const completedTasks = tasks.filter(task => task.completed === true);
                        if (completedTasks.length > 0) {
                            return res.status(400).json({
                                message: "Cannot add completed tasks to pendingTasks. Only non-completed tasks can be added.",
                                data: {}
                            });
                        }

                        // Check if all tasks exist (tasks array length should match tasksToAdd length)
                        if (tasks.length !== tasksToAdd.length) {
                            return res.status(404).json({
                                message: "One or more tasks not found.",
                                data: {}
                            });
                        }

                        // Validation passed, proceed with email check and update
                        checkEmailAndUpdate();
                    });
                } else {
                    // No new tasks to add, proceed with email check and update
                    checkEmailAndUpdate();
                }

                function checkEmailAndUpdate() {
                    // Check if email is being changed to one that already exists (excluding current user)
                    if (req.body.email.trim() !== existingUser.email) {
                        User.findOne({ email: req.body.email.trim() }, (err, userWithEmail) => {
                            if (err) {
                                return res.status(500).json({
                                    message: "Server error occurred while checking email.",
                                    data: {}
                                });
                            }
                            if (userWithEmail) {
                                return res.status(400).json({
                                    message: "A user with this email already exists.",
                                    data: {}
                                });
                            }
                            performUpdate(oldPendingTasks, newPendingTasks, existingUser);
                        });
                    } else {
                        performUpdate(oldPendingTasks, newPendingTasks, existingUser);
                    }
                }
            });

            function performUpdate(oldPendingTasks, newPendingTasks, existingUser) {
                // Build update data - preserve dateCreated from existing user
                const updateData = {
                    name: req.body.name.trim(),
                    email: req.body.email.trim(),
                    dateCreated: existingUser.dateCreated // Preserve dateCreated
                };

                // Set default values for fields not specified
                if (req.body.pendingTasks !== undefined) {
                    // Persist the deduplicated list
                    updateData.pendingTasks = Array.from(new Set(newPendingTasks));
                } else {
                    updateData.pendingTasks = [];
                }

                // Replace entire user
                User.findByIdAndUpdate(
                    req.params.id,
                    updateData,
                    { new: true, runValidators: true },
                    (err, updatedUser) => {
                        if (err) {
                            return res.status(500).json({
                                message: "Server error occurred while updating user.",
                                data: {}
                            });
                        }

                        if (!updatedUser) {
                            return res.status(404).json({
                                message: "User not found.",
                                data: {}
                            });
                        }

                        // Maintain two-way reference: update tasks' assignedUser and assignedUserName
                        // Convert arrays to sets of strings for easier comparison
                        const oldTaskSet = new Set(oldPendingTasks.map(t => t.toString()));
                        const newTaskSet = new Set(newPendingTasks.map(t => t.toString()));

                        // Find tasks that were removed (in old but not in new)
                        const tasksToUnassign = oldPendingTasks.filter(taskId => !newTaskSet.has(taskId.toString()));
                        
                        // Find tasks that were added (in new but not in old)
                        const tasksToAssign = newPendingTasks.filter(taskId => !oldTaskSet.has(taskId.toString()));

                        // Two-way reference 1: Unassign tasks that were removed from pendingTasks
                        if (tasksToUnassign.length > 0) {
                            Task.updateMany(
                                { _id: { $in: tasksToUnassign } },
                                {
                                    assignedUser: "",
                                    assignedUserName: "unassigned"
                                },
                                (err) => {
                                    // Continue even if error
                                }
                            );
                        }

                        // Two-way reference 2: Remove tasks from other users' pendingTasks before assigning to this user
                        // First, find which tasks are currently assigned to other users
                        if (tasksToAssign.length > 0) {
                            Task.find({ _id: { $in: tasksToAssign }, assignedUser: { $ne: "" } }, (err, tasksAssignedToOthers) => {
                                if (!err && tasksAssignedToOthers.length > 0) {
                                    // Group tasks by their current assignedUser
                                    const tasksByUser = {};
                                    tasksAssignedToOthers.forEach(task => {
                                        const assignedUser = task.assignedUser;
                                        if (!tasksByUser[assignedUser]) {
                                            tasksByUser[assignedUser] = [];
                                        }
                                        tasksByUser[assignedUser].push(task._id.toString());
                                    });

                                    // Remove tasks from each user's pendingTasks
                                    Object.keys(tasksByUser).forEach(userId => {
                                        User.findByIdAndUpdate(
                                            userId,
                                            { $pullAll: { pendingTasks: tasksByUser[userId] } },
                                            (err) => {
                                                // Continue even if error
                                            }
                                        );
                                    });
                                }
                            });
                        }

                        // Two-way reference 3: Assign tasks that were added to pendingTasks
                        if (tasksToAssign.length > 0) {
                            Task.updateMany(
                                { _id: { $in: tasksToAssign } },
                                {
                                    assignedUser: updatedUser._id.toString(),
                                    assignedUserName: updatedUser.name
                                },
                                (err) => {
                                    // Continue even if error
                                }
                            );
                        }

                        return res.status(200).json({
                            message: "OK",
                            data: updatedUser
                        });
                    }
                );
            }
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    singleUserRoute.delete((req, res) => {
        User.findByIdAndDelete(req.params.id, (err, user) => {
            if (err) {
                return res.status(500).json({
                    message: "Server error occurred while deleting user.",
                    data: {}
                });
            } else if (!user) {
                return res.status(404).json({
                    message: "User not found.",
                    data: {}
                });
            }

            // Unassign all pending tasks that were assigned to this user
            Task.updateMany(
                { assignedUser: req.params.id },
                { 
                    assignedUser: "",
                    assignedUserName: "unassigned"
                },
                (err, result) => {
                    if (err) {
                        // Even if task update fails, user is already deleted
                        // Return success
                    }

                    // Return 204 No Content on successful deletion
                    return res.status(204).send();
                }
            );
        });
    })


    return router
}