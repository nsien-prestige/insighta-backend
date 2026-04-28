const requireApiVersion = (req, res, next) => {
    const apiVersion = req.headers['x-api-version'];

    if (!apiVersion) {
        return res.status(400).json({
            "status": "error",
            "message": "API version header required"
        });
    }

    next()
}

module.exports = requireApiVersion